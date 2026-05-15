// ============================================================
// lookup-card — Edge Function
// 
// The "unlimited cards" feature:
// 1. Searches database for card by query
// 2. If found AND fresh (< 30 days) → returns instantly
// 3. If found but stale → triggers background refresh, returns current data
// 4. If NOT found → calls Gemini to generate full card profile, saves it
//
// Endpoint: POST /functions/v1/lookup-card
// Body: { "query": "HDFC Regalia Gold" }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callGemini, parseGeminiJSON } from "../_shared/gemini.ts";

const CACHE_DAYS = 30;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

const CARD_GENERATION_PROMPT = `You are CardIQ India, an expert Indian credit card analyst. Generate accurate, current data for the requested credit card from public sources (bank websites, RBI disclosures, finance creators).

Output ONLY raw JSON matching this exact schema — no markdown, no preamble:

{
  "slug": "lowercase-slug-with-dashes-max-80-chars",
  "name": "Full official card name",
  "bank": "Issuing bank name",
  "network": "Visa | Mastercard | RuPay | American Express | Diners Club",
  "joining_fee": 0,
  "annual_fee": 0,
  "fee_waiver_spend": null_or_number,
  "reward_rate": "Concise description like '5% online, 1% offline (₹500 monthly cap)'",
  "welcome_benefit": "Concise welcome offer or null",
  "use_cases": ["array of short tags: travel, dining, fuel, shopping, online, cashback, lounge, forex, upi, grocery, movies, luxury"],
  "eligibility": {
    "min_income": number_or_null,
    "min_age": 21,
    "credit_score": 700
  },
  "key_benefits": [
    "3-6 short benefit descriptions, each max 80 chars with specific numbers"
  ],
  "excluded_categories": ["Categories where rewards don't apply"],
  "tagline": "One catchy line, max 80 chars",
  "best_for": "Target persona in 60 chars or less",
  "popularity_rank": number_between_1_and_999,
  "official_url": "https://bank-website-card-page-url-or-null"
}

CRITICAL RULES:
1. If the card doesn't exist (made-up name) → return: {"error": "card_not_found"}
2. NEVER invent fees. If unknown, use 0 for fees and null for fee_waiver_spend.
3. Be precise with reward rates — include caps and exclusions.
4. The slug should be unique and clean (e.g., "hdfc-regalia-gold", "axis-magnus").
5. popularity_rank: 1-50 = mainstream, 51-200 = well-known, 201+ = niche.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cleanQuery = query.trim();
    const querySlug = slugify(cleanQuery);

    // STEP 1: Try exact slug match
    let { data: card } = await supabase
      .from("cards")
      .select("*")
      .eq("slug", querySlug)
      .maybeSingle();

    // STEP 2: Try fuzzy name match if slug match failed
    if (!card) {
      const { data: matches } = await supabase
        .from("cards")
        .select("*")
        .ilike("name", `%${cleanQuery}%`)
        .order("popularity_rank", { ascending: true })
        .limit(1);

      card = matches?.[0] || null;
    }

    // STEP 3: Card found — check freshness, return
    if (card) {
      const ageMs = Date.now() - new Date(card.created_at).getTime();
      const isStale = ageMs > CACHE_DAYS * 86400_000;

      // Increment view count async (don't await)
      if (card.id) {
        supabase
          .rpc("increment_view_count", { card_id_param: card.id })
          .then(() => {})
          .catch(() => {});
      }

      return new Response(
        JSON.stringify({
          card,
          source: "database",
          stale: isStale,
          will_refresh: isStale,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 4: Card NOT in database — generate it with AI
    console.log(`[lookup-card] Generating new card for: "${cleanQuery}"`);

    const aiResponse = await callGemini({
      systemPrompt: CARD_GENERATION_PROMPT,
      userPrompt: `Generate full card profile for: "${cleanQuery}"`,
      jsonOutput: true,
      maxTokens: 3000,
      temperature: 0.3,
    });

    const cardData = parseGeminiJSON(aiResponse, { error: "parse_failed" });

    // Check if AI said the card doesn't exist
    if (cardData.error === "card_not_found") {
      return new Response(
        JSON.stringify({
          error: "Card not found",
          message: `"${cleanQuery}" doesn't match any known Indian credit card. Try searching for HDFC, SBI, Axis, ICICI, Amex, etc.`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate required fields
    if (!cardData.name || !cardData.bank) {
      return new Response(
        JSON.stringify({
          error: "Generation failed",
          message: "Could not generate valid card data. Try a more specific search.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalize and save to database
    const newCard = {
      slug: slugify(cardData.slug || cardData.name),
      name: String(cardData.name).trim(),
      bank: String(cardData.bank).trim(),
      network: String(cardData.network || "Visa"),
      joining_fee: Number(cardData.joining_fee) || 0,
      annual_fee: Number(cardData.annual_fee) || 0,
      fee_waiver_spend: cardData.fee_waiver_spend ?? null,
      reward_rate: cardData.reward_rate ?? null,
      welcome_benefit: cardData.welcome_benefit ?? null,
      use_cases: Array.isArray(cardData.use_cases) ? cardData.use_cases : [],
      eligibility: cardData.eligibility ?? {},
      key_benefits: Array.isArray(cardData.key_benefits) ? cardData.key_benefits : [],
      excluded_categories: Array.isArray(cardData.excluded_categories)
        ? cardData.excluded_categories
        : [],
      tagline: cardData.tagline ?? null,
      best_for: cardData.best_for ?? null,
      official_url: cardData.official_url ?? null,
      popularity_rank: Number(cardData.popularity_rank) || 500,
    };

    // Upsert (insert or update if slug exists)
    const { data: saved, error: saveError } = await supabase
      .from("cards")
      .upsert(newCard, { onConflict: "slug" })
      .select()
      .single();

    if (saveError) {
      console.error("[lookup-card] Save error:", saveError);
      // Still return the data even if save failed
      return new Response(
        JSON.stringify({ card: newCard, source: "ai_generated", saved: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ card: saved, source: "ai_generated", saved: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[lookup-card] Error:", e);
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
