// Seed cards from a bank's official credit-card listing page.
// Flow: Firecrawl scrape (markdown) -> Gemini structured extraction -> upsert into `cards`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_MODEL = "google/gemini-3-flash-preview";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

async function firecrawlScrape(url: string): Promise<string> {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Firecrawl ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.data?.markdown ?? data.markdown ?? "";
}

const EXTRACTION_PROMPT = `You are extracting Indian credit card data. From the provided webpage markdown, extract EVERY distinct credit card product mentioned.

Return ONLY a JSON array (no prose, no code fences). Each item must follow this exact shape:

{
  "name": "string (full official card name, e.g. 'HDFC Bank Diners Club Black Metal')",
  "bank": "string (issuing bank, e.g. 'HDFC Bank')",
  "network": "Visa|Mastercard|RuPay|American Express|Diners Club",
  "joining_fee": number (INR, 0 if free, 0 if unknown),
  "annual_fee": number (INR),
  "fee_waiver_spend": number or null,
  "reward_rate": "string (e.g. '5X on dining, 1X on others') or null",
  "welcome_benefit": "string or null",
  "use_cases": ["short tag", ...] (e.g. ["travel","dining","fuel","shopping","luxury","forex","upi","cashback"]),
  "key_benefits": ["one-line benefit", ...] (3-6 items),
  "excluded_categories": ["string", ...],
  "tagline": "string (<=80 chars, punchy)",
  "best_for": "string (<=60 chars, one audience)",
  "eligibility": { "min_income": number_or_null, "min_age": number_or_null, "credit_score": number_or_null },
  "popularity_rank": number (1-999, lower = more popular)
}

Rules:
- Only include real, currently-issued cards. Skip debit cards, prepaid, forex cards, business-only unless clearly a credit card.
- If a numeric field is unknown, use 0 (fees) or null (others). Do not invent fees.
- Keep arrays concise.
- Return [] if no cards found.`;

async function geminiExtract(markdown: string, bankHint: string): Promise<any[]> {
  const prompt = `${EXTRACTION_PROMPT}\n\nBank context: ${bankHint}\n\nWEBPAGE MARKDOWN:\n${markdown.slice(0, 60000)}`;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const { bank, urls } = await req.json();
    if (!bank || !Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ error: "bank and urls[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const log: string[] = [];
    const allCards: any[] = [];

    for (const url of urls) {
      try {
        log.push(`Scraping ${url}`);
        const md = await firecrawlScrape(url);
        log.push(`  → ${md.length} chars`);
        const cards = await geminiExtract(md, bank);
        log.push(`  → extracted ${cards.length} cards`);
        allCards.push(...cards);
      } catch (e) {
        log.push(`  ✗ ${(e as Error).message}`);
      }
    }

    // Dedupe by slug, normalize, upsert
    const seen = new Set<string>();
    const rows = allCards
      .map((c) => {
        const name = String(c.name || "").trim();
        if (!name) return null;
        const slug = slugify(`${c.bank || bank}-${name}`);
        if (seen.has(slug)) return null;
        seen.add(slug);
        return {
          slug,
          name,
          bank: String(c.bank || bank),
          network: String(c.network || "Visa"),
          joining_fee: Number(c.joining_fee) || 0,
          annual_fee: Number(c.annual_fee) || 0,
          fee_waiver_spend: c.fee_waiver_spend ?? null,
          reward_rate: c.reward_rate ?? null,
          welcome_benefit: c.welcome_benefit ?? null,
          use_cases: Array.isArray(c.use_cases) ? c.use_cases : [],
          key_benefits: Array.isArray(c.key_benefits) ? c.key_benefits : [],
          excluded_categories: Array.isArray(c.excluded_categories) ? c.excluded_categories : [],
          tagline: c.tagline ?? null,
          best_for: c.best_for ?? null,
          eligibility: c.eligibility ?? {},
          popularity_rank: Number(c.popularity_rank) || 999,
        };
      })
      .filter(Boolean);

    let upserted = 0;
    if (rows.length > 0) {
      const { error, count } = await supabase
        .from("cards")
        .upsert(rows as any, { onConflict: "slug", count: "exact" });
      if (error) throw error;
      upserted = count ?? rows.length;
    }
    log.push(`Upserted ${upserted} cards.`);

    return new Response(
      JSON.stringify({ ok: true, upserted, attempted: rows.length, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
