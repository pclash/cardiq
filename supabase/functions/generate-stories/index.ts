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

    const { data: cached } = await supabase
      .from("card_stories")
      .select("stories, generated_at")
      .eq("card_id", card_id)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.generated_at).getTime();
      if (ageMs < CACHE_DAYS * 86400_000) {
        return new Response(JSON.stringify({ stories: cached.stories, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: card } = await supabase.from("cards").select("*").eq("id", card_id).single();
    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a writer creating short, fun, anonymized credit-card "hack" anecdotes for Indian audiences.
STRICT RULES:
- NEVER name real people, Reddit usernames, X handles, or any individuals.
- NEVER quote or paraphrase any specific post. Write fresh anonymous anecdotes inspired by widely-known general community patterns only.
- Anecdotes must reflect realistic, legal optimization patterns (milestone hitting, category stacking with other cards, lounge access tricks, welcome-bonus timing, foreign-spend hacks, redemption arbitrage). Do NOT describe fraud, manufactured-spend abuse, or anything that violates card T&Cs.
- Tone: witty, punchy, 2-4 sentences each. No hype, no fake numbers. Use "a user", "one cardholder", "a Bengaluru techie" style anonymization.
- Output ONLY valid JSON. No markdown.`;

    const userPrompt = `CARD: ${card.name} (${card.bank})\nUse cases: ${(card.use_cases || []).join(", ")}\nKey benefits: ${(card.key_benefits || []).join(" | ")}\n\nReturn JSON:\n{\n  "stories": [\n    { "title": string, "story": string, "vibe": "smart" | "wild" | "wholesome" | "savage" }\n  ]\n}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
      return new Response(JSON.stringify({ error: `AI gateway error (${aiRes.status})` }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let stories;
    try { stories = JSON.parse(content); }
    catch { stories = { stories: [] }; }

    await supabase.from("card_stories").upsert(
      { card_id, stories, generated_at: new Date().toISOString() },
      { onConflict: "card_id" },
    );

    return new Response(JSON.stringify({ stories, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-stories error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
