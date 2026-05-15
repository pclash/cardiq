// ============================================================
// generate-insights — Edge Function
// 
// Generates AI insights for a credit card using Google Gemini.
// Caches results for 30 days in ai_insights_cache table.
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
      .from("ai_insights_cache")
      .select("insights, generated_at")
      .eq("card_id", card_id)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.generated_at).getTime();
      if (ageMs < CACHE_DAYS * 86400_000) {
        return new Response(
          JSON.stringify({ insights: cached.insights, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch the card details
    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .select("*")
      .eq("id", card_id)
      .single();

    if (cardErr || !card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch peer cards for alternatives
    const { data: peers } = await supabase
      .from("cards")
      .select("slug,name,bank,use_cases,best_for")
      .neq("id", card_id)
      .limit(60);

    const systemPrompt = `You are an Indian credit card expert. Output strictly factual, neutral, AI-synthesized analysis as JSON only.
Rules:
- NEVER quote or attribute opinions to specific people, Reddit users, X handles, or any individuals.
- NEVER invent fees, reward rates, or eligibility numbers — work only from the structured data given. If unknown, say "varies — check bank site".
- Synthesize "general consensus" from common publicly-known patterns about this card category.
- No hype, no marketing tone, helpful and clear.
- Output ONLY valid JSON matching the schema. No markdown, no commentary.`;

    const userPrompt = `CARD:
${JSON.stringify(card, null, 2)}

PEER CARDS (pick alternatives only from these slugs):
${JSON.stringify(peers, null, 2)}

Return JSON:
{
  "best_use_cases": [{"title": string, "detail": string}],
  "avoid_for": [{"title": string, "detail": string}],
  "excluded_categories": [string],
  "community_sentiment": string,
  "alternatives": [{"slug": string, "name": string, "why": string}]
}`;

    // Call Gemini
    const responseText = await callGemini({
      systemPrompt,
      userPrompt,
      jsonOutput: true,
      maxTokens: 4000,
    });

    const insights = parseGeminiJSON(responseText, {
      error: "Failed to parse AI response",
      raw: responseText,
    });

    // Save to cache
    await supabase.from("ai_insights_cache").upsert(
      {
        card_id,
        insights,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "card_id" },
    );

    return new Response(
      JSON.stringify({ insights, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-insights error", e);
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
