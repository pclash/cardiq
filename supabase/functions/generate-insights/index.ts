import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_DAYS = 30;

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

    // Check cache
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

    // Fetch the card
    const { data: card, error: cardErr } = await supabase
      .from("cards").select("*").eq("id", card_id).single();
    if (cardErr || !card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull peers in same use cases
    const { data: peers } = await supabase
      .from("cards").select("slug,name,bank,use_cases,best_for")
      .neq("id", card_id).limit(60);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an Indian credit card expert. Given a card's structured data and a list of peer cards, output strictly factual, neutral, AI-synthesized analysis.
Rules:
- Do NOT quote or attribute opinions to specific people, Reddit users, X/Twitter handles, or any individuals.
- Do NOT invent fees, reward rates, or eligibility numbers — work only from the structured data given. If unknown, say "varies — check bank site".
- Synthesize "general consensus" only from common, publicly known patterns about this card category.
- Keep tone helpful, clear, no hype.
- Output ONLY valid JSON matching the schema, no markdown.`;

    const userPrompt = `CARD:
${JSON.stringify(card, null, 2)}

PEER CARDS (pick alternatives only from these slugs):
${JSON.stringify(peers, null, 2)}

Return JSON with keys:
{
  "best_use_cases": [ { "title": string, "detail": string } ],   // 4-6 items, where this card shines
  "avoid_for": [ { "title": string, "detail": string } ],         // 3-5 items: who shouldn't get it / weak spots
  "excluded_categories": [ string ],                              // categories where rewards don't apply (rent, wallet load, fuel surcharge, govt, etc.)
  "community_sentiment": string,                                  // 2-3 sentence neutral synthesized summary, no quotes, no usernames
  "alternatives": [ { "slug": string, "name": string, "why": string } ] // 3 cards from peer list, with 1-line reason
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let insights;
    try { insights = JSON.parse(content); }
    catch { insights = { error: "Failed to parse AI response", raw: content }; }

    // Cache
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
