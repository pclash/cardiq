// ============================================================
// refresh-stale — Edge Function (Monthly Batch Refresh)
//
// Refreshes all cards in the database to keep data current.
// Runs on the 1st of every month via pg_cron.
// Can also be triggered manually for testing.
//
// Features:
// - Paces requests (1 per 5 seconds) to stay within Gemini rate limits
// - Skips cards refreshed in last 7 days (avoid double-work)
// - Logs progress to refresh_log table
//
// Endpoint: POST /functions/v1/refresh-stale
// Body (optional): { "limit": 100, "force": false }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callGemini, parseGeminiJSON } from "../_shared/gemini.ts";

const RATE_LIMIT_DELAY_MS = 5000; // 5 sec between calls = 12/min (Gemini limit: 15/min)
const SKIP_IF_FRESHER_THAN_DAYS = 7; // Don't refresh if updated in last 7 days

const REFRESH_PROMPT = `You are CardIQ India, an expert Indian credit card analyst. Update the card details with current accurate information from public sources.

Output ONLY raw JSON matching this exact schema — no markdown, no preamble:

{
  "name": "Full official card name (may be updated if rebranded)",
  "bank": "Issuing bank",
  "network": "Visa | Mastercard | RuPay | American Express | Diners Club",
  "joining_fee": 0,
  "annual_fee": 0,
  "fee_waiver_spend": null_or_number,
  "reward_rate": "Current reward rate with caps",
  "welcome_benefit": "Current welcome offer",
  "use_cases": ["array of short tags"],
  "eligibility": { "min_income": null_or_number, "min_age": 21, "credit_score": 700 },
  "key_benefits": ["3-6 current benefits with numbers"],
  "excluded_categories": ["Categories where rewards don't apply"],
  "tagline": "Updated tagline",
  "best_for": "Target persona",
  "popularity_rank": number_between_1_and_999
}

If the card has been discontinued, return: { "status": "discontinued" }
Be accurate. If unsure about a fee or rate, keep the existing value rather than guessing.`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Parse options (optional)
    let limit = 1000;
    let force = false;

    try {
      const body = await req.json();
      limit = Math.min(Number(body.limit) || 1000, 1000);
      force = Boolean(body.force);
    } catch {
      // No body provided, use defaults
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch cards to refresh (oldest first)
    let queryBuilder = supabase
      .from("cards")
      .select("id, slug, name, bank, created_at");

    if (!force) {
      // Skip cards updated in last 7 days
      const skipDate = new Date(Date.now() - SKIP_IF_FRESHER_THAN_DAYS * 86400_000);
      queryBuilder = queryBuilder.lt("created_at", skipDate.toISOString());
    }

    const { data: cards, error: fetchError } = await queryBuilder
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchError) throw fetchError;

    if (!cards || cards.length === 0) {
      return new Response(
        JSON.stringify({
          status: "no_cards_to_refresh",
          total: 0,
          message: "All cards are fresh (refreshed within last 7 days)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[refresh-stale] Starting refresh of ${cards.length} cards...`);

    const results = {
      total: cards.length,
      refreshed: 0,
      skipped: 0,
      discontinued: 0,
      errors: 0,
      details: [] as Array<{ slug: string; status: string; reason?: string }>,
    };

    // Process cards one at a time with pacing
    for (const card of cards) {
      try {
        const aiResponse = await callGemini({
          systemPrompt: REFRESH_PROMPT,
          userPrompt: `Update details for: "${card.name}" by ${card.bank}`,
          jsonOutput: true,
          maxTokens: 3000,
          temperature: 0.3,
        });

        const updated = parseGeminiJSON(aiResponse, { error: "parse_failed" });

        // Handle discontinued cards
        if (updated.status === "discontinued") {
          // Mark as low popularity but don't delete (preserve cached data)
          await supabase
            .from("cards")
            .update({ popularity_rank: 999 })
            .eq("id", card.id);

          results.discontinued++;
          results.details.push({ slug: card.slug, status: "discontinued" });
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        // Validate and update
        if (!updated.name) {
          results.errors++;
          results.details.push({
            slug: card.slug,
            status: "error",
            reason: "Invalid AI response",
          });
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        // Update the card
        const updates = {
          name: updated.name,
          bank: updated.bank,
          network: updated.network || "Visa",
          joining_fee: Number(updated.joining_fee) || 0,
          annual_fee: Number(updated.annual_fee) || 0,
          fee_waiver_spend: updated.fee_waiver_spend ?? null,
          reward_rate: updated.reward_rate ?? null,
          welcome_benefit: updated.welcome_benefit ?? null,
          use_cases: Array.isArray(updated.use_cases) ? updated.use_cases : [],
          eligibility: updated.eligibility ?? {},
          key_benefits: Array.isArray(updated.key_benefits) ? updated.key_benefits : [],
          excluded_categories: Array.isArray(updated.excluded_categories)
            ? updated.excluded_categories
            : [],
          tagline: updated.tagline ?? null,
          best_for: updated.best_for ?? null,
          popularity_rank: Number(updated.popularity_rank) || card.popularity_rank || 500,
        };

        const { error: updateError } = await supabase
          .from("cards")
          .update(updates)
          .eq("id", card.id);

        if (updateError) {
          results.errors++;
          results.details.push({
            slug: card.slug,
            status: "error",
            reason: updateError.message,
          });
        } else {
          results.refreshed++;
          results.details.push({ slug: card.slug, status: "refreshed" });

          // Invalidate AI insights cache for this card (so insights regenerate next time viewed)
          await supabase
            .from("ai_insights_cache")
            .delete()
            .eq("card_id", card.id);
        }
      } catch (e) {
        results.errors++;
        results.details.push({
          slug: card.slug,
          status: "error",
          reason: e instanceof Error ? e.message : "Unknown",
        });
      }

      // Pace requests
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    return new Response(
      JSON.stringify({
        status: "completed",
        duration_seconds: duration,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[refresh-stale] Error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
