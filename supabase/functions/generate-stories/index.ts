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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const systemPrompt = `You are a writer creating short, fun, anonymized credit-card "hack" anecdotes for Indian audiences.
STRICT RULES:
- NEVER name real people, Reddit usernames, X handles, or any individuals.
- NEVER quote or paraphrase any specific post. Write fresh anonymous anecdotes inspired by widely-known general community patterns only.
- Anecdotes must reflect realistic, legal optimization patterns (milestone hitting, category stacking with other cards, lounge access tricks, welcome-bonus timing, foreign-spend hacks, redemption arbitrage). Do NOT describe fraud, manufactured-spend abuse, or anything that violates card T&Cs.
- Tone: witty, punchy, 2-4 sentences each. No hype, no fake numbers. Use "a user", "one cardholder", "a Bengaluru techie" style anonymization.
- Output ONLY valid JSON. No markdown.`;

    const userPrompt = `CARD: ${card.name} (${card.bank})\nUse cases: ${card.use_cases.join(", ")}\nKey benefits: ${card.key_benefits.join(" | ")}\n\nReturn JSON:\n{\n  "stories": [\n    { "title": string, "story": string, "vibe": "smart" | "wild" | "wholesome" | "savage" }\n  ]  // exactly 3 anonymized anecdotes\n}`;

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
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
