// Pre-generates insights + stories for every card and stores them in DB,
// so user visits never hit Gemini live.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function invoke(fn: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { only } = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cards, error } = await supabase.from("cards").select("id, slug, name");
    if (error) throw error;

    const existingInsights = new Set(
      ((await supabase.from("ai_insights_cache").select("card_id")).data ?? []).map((r: any) => r.card_id),
    );
    const existingStories = new Set(
      ((await supabase.from("card_stories").select("card_id")).data ?? []).map((r: any) => r.card_id),
    );

    const log: string[] = [];
    let insightsDone = 0, storiesDone = 0, failed = 0;

    for (const c of cards ?? []) {
      try {
        if (only !== "stories" && !existingInsights.has(c.id)) {
          await invoke("generate-insights", { card_id: c.id });
          insightsDone++;
        }
        if (only !== "insights" && !existingStories.has(c.id)) {
          await invoke("generate-stories", { card_id: c.id });
          storiesDone++;
        }
        log.push(`✓ ${c.name}`);
      } catch (e) {
        failed++;
        log.push(`✗ ${c.name}: ${(e as Error).message}`);
      }
      // tiny gap to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: cards?.length ?? 0,
        insightsDone,
        storiesDone,
        failed,
        log: log.slice(-200),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
