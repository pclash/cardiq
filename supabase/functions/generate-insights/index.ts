import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_DAYS = 30;
const AI_MODEL = "google/gemini-3-flash-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { card_id } = await req.json();
    if (!card_id || typeof card_id !== "string") {
      return new Response(JSON.stringify({ error: "card_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check cache (30 days)
    const { data: cached } = await supabase
      .from("ai_insights_cache")
      .select("insights, generated_at")
      .eq("card_id", card_id)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.generated_at).getTime();
      if (ageMs < CACHE_DAYS * 86400_000) {
        return new Response(JSON.stringify({ insights: cached.insights, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: card, error: cardErr } = await supabase
      .from("cards").select("*").eq("id", card_id).single();
    if (cardErr || !card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: peers } = await supabase
      .from("cards").select("slug,name,bank,use_cases,best_for")
      .neq("id", card_id).limit(60);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const systemPrompt = `You are an Indian credit card expert. Output strictly factual, neutral, AI-synthesized analysis as JSON only.
Rules:
- NEVER quote or attribute opinions to specific people, Reddit users, X handles, or any individuals.
- NEVER invent fees, reward rates, or eligibility numbers — work only from the structured data given. If unknown, say "varies — check bank site".
- Synthesize "general consensus" from common publicly-known patterns about this card category.
- No hype, no marketing tone, helpful and clear.
- Output ONLY valid JSON matching the schema. No markdown, no commentary.`;

    const userPrompt = `CARD:\n${JSON.stringify(card, null, 2)}\n\nPEER CARDS (pick alternatives only from these slugs):\n${JSON.stringify(peers, null, 2)}\n\nReturn JSON:\n{\n  "best_use_cases": [{"title": string, "detail": string}],   // 4-6 items\n  "avoid_for": [{"title": string, "detail": string}],        // 3-5 items\n  "excluded_categories": [string],\n  "community_sentiment": string,                              // 2-3 sentences, neutral, no quotes/usernames\n  "alternatives": [{"slug": string, "name": string, "why": string}] // 3 from peer list\n}`;

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      },
    );

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Gemini error", aiRes.status, t);
      return new Response(JSON.stringify({ error: `Gemini API error (${aiRes.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let insights;
    try { insights = JSON.parse(content); }
    catch { insights = { error: "Failed to parse AI response", raw: content }; }

    await supabase.from("ai_insights_cache").upsert(
      { card_id, insights, generated_at: new Date().toISOString() },
      { onConflict: "card_id" },
    );

    return new Response(JSON.stringify({ insights, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-insights error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
