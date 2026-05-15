// ============================================================
// generate-stories — Edge Function
// 
// Generates fun anonymized credit card "hack" anecdotes using Gemini.
// Caches results for 30 days in card_stories table.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callGemini, parseGeminiJSON } from "../_shared/gemini.ts";

const CACHE_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { card_id } = await req.json();

    if (!card_id || typeof card_id !== "string") {
      return new Response(JSON.stringify({ error: "card_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check cache (30 days)
    const { data: cached } = await supabase
      .from("card_stories")
      .select("stories, generated_at")
      .eq("card_id", card_id)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.generated_at).getTime();
      if (ageMs < CACHE_DAYS * 86400_000) {
        return new Response(
          JSON.stringify({ stories: cached.stories, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch card details
    const { data: card } = await supabase
      .from("cards")
      .select("*")
      .eq("id", card_id)
      .single();

    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a writer creating short, fun, anonymized credit-card "hack" anecdotes for Indian audiences.
STRICT RULES:
- NEVER name real people, Reddit usernames, X handles, or any individuals.
- NEVER quote or paraphrase any specific post. Write fresh anonymous anecdotes inspired by widely-known general community patterns only.
- Anecdotes must reflect realistic, legal optimization patterns (milestone hitting, category stacking with other cards, lounge access tricks, welcome-bonus timing, foreign-spend hacks, redemption arbitrage). Do NOT describe fraud, manufactured-spend abuse, or anything that violates card T&Cs.
- Tone: witty, punchy, 2-4 sentences each. No hype, no fake numbers. Use "a user", "one cardholder", "a Bengaluru techie" style anonymization.
- Output ONLY valid JSON. No markdown.`;

    const userPrompt = `CARD: ${card.name} (${card.bank})
Use cases: ${(card.use_cases || []).join(", ")}
Key benefits: ${(card.key_benefits || []).join(" | ")}

Return JSON:
{
  "stories": [
    { "title": string, "story": string, "vibe": "smart" | "wild" | "wholesome" | "savage" }
  ]
}`;

    // Call Gemini
    const responseText = await callGemini({
      systemPrompt,
      userPrompt,
      jsonOutput: true,
      maxTokens: 3000,
      temperature: 0.8, // Higher temp for more creative stories
    });

    const stories = parseGeminiJSON(responseText, { stories: [] });

    // Save to cache
    await supabase.from("card_stories").upsert(
      {
        card_id,
        stories,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "card_id" },
    );

    return new Response(
      JSON.stringify({ stories, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-stories error", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
