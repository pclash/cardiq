import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Card as CardT, Insights, Stories } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CardThumb from "@/components/CardThumb";
import { ArrowLeft, ExternalLink, Sparkles, CheckCircle2, XCircle, AlertTriangle, Users, Flame } from "lucide-react";
import { toast } from "sonner";

export default function CardDetail() {
  const { slug } = useParams();
  const [card, setCard] = useState<CardT | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [stories, setStories] = useState<Stories | null>(null);
  const [loadingStories, setLoadingStories] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase.from("cards").select("*").eq("slug", slug).maybeSingle().then(({ data }) => {
      setCard((data ?? null) as CardT | null);
      setLoading(false);
      if (data) {
        loadInsights(data.id);
        loadStories(data.id);
      }
    });
  }, [slug]);

  async function loadInsights(card_id: string) {
    setLoadingInsights(true);
    setInsights(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", { body: { card_id } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setInsights(data.insights);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load insights");
    } finally {
      setLoadingInsights(false);
    }
  }

  async function loadStories(card_id: string) {
    setLoadingStories(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-stories", { body: { card_id } });
      if (error) throw error;
      if (data?.error) return;
      setStories(data.stories);
    } catch { /* silent */ }
    finally { setLoadingStories(false); }
  }

  if (loading) return <div className="container py-16 text-muted-foreground">Loading…</div>;
  if (!card) return (
    <div className="container py-16">
      <p>Card not found.</p>
      <Link to="/" className="text-primary text-sm">← Back to browse</Link>
    </div>
  );

  return (
    <>
      <div className="border-b bg-secondary/30">
        <div className="container py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to all cards
          </Link>
        </div>
      </div>

      <section className="container py-8 grid md:grid-cols-[320px_1fr] gap-8">
        <div className="space-y-4">
          <CardThumb name={card.name} bank={card.bank} />
          {card.official_url && (
            <Button asChild className="w-full">
              <a href={card.official_url} target="_blank" rel="noopener noreferrer">
                Apply on {card.bank} <ExternalLink className="w-3 h-3 ml-2" />
              </a>
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            We don't earn commissions. Always verify on the official bank site.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">{card.bank} · {card.network}</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">{card.name}</h1>
            {card.tagline && <p className="text-lg text-muted-foreground mt-2">{card.tagline}</p>}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {card.use_cases.map(u => <Badge key={u} variant="secondary">{u}</Badge>)}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Joining fee" value={card.joining_fee === 0 ? "Free" : `₹${card.joining_fee.toLocaleString("en-IN")}`} />
            <Stat label="Annual fee" value={card.annual_fee === 0 ? "Free" : `₹${card.annual_fee.toLocaleString("en-IN")}`} />
            <Stat label="Fee waiver at" value={card.fee_waiver_spend ? `₹${card.fee_waiver_spend.toLocaleString("en-IN")}` : "—"} />
            <Stat label="Reward rate" value={card.reward_rate ?? "—"} small />
          </div>

          <Section title="Welcome benefit"><p className="text-sm">{card.welcome_benefit ?? "—"}</p></Section>

          <Section title="Eligibility">
            <dl className="grid sm:grid-cols-3 gap-4 text-sm">
              <Field k="Min income" v={card.eligibility?.min_income} />
              <Field k="Employment" v={card.eligibility?.employment} />
              <Field k="Age" v={card.eligibility?.age} />
            </dl>
          </Section>

          <Section title="Key benefits">
            <ul className="space-y-2 text-sm">
              {card.key_benefits.map((b, i) => (
                <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" /><span>{b}</span></li>
              ))}
            </ul>
          </Section>

          {card.excluded_categories.length > 0 && (
            <Section title="Where this card does NOT earn rewards" tone="warn">
              <div className="flex flex-wrap gap-2">
                {card.excluded_categories.map(c => (
                  <Badge key={c} variant="outline" className="border-warning/40 text-warning bg-warning/5">
                    <XCircle className="w-3 h-3 mr-1" /> {c}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          {/* AI Insights */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-card flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">AI Insights</h2>
                <p className="text-xs text-muted-foreground">Synthesized analysis · verify all numbers on the bank site</p>
              </div>
            </div>

            {loadingInsights && <p className="text-sm text-muted-foreground">Generating insights…</p>}

            {insights && (
              <>
                {insights.best_use_cases?.length ? (
                  <InsightBlock icon={<CheckCircle2 className="w-4 h-4 text-success" />} title="Best use cases">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {insights.best_use_cases.map((u, i) => (
                        <div key={i} className="rounded-lg border bg-background p-3">
                          <div className="font-medium text-sm">{u.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">{u.detail}</div>
                        </div>
                      ))}
                    </div>
                  </InsightBlock>
                ) : null}

                {insights.avoid_for?.length ? (
                  <InsightBlock icon={<AlertTriangle className="w-4 h-4 text-warning" />} title="Who should NOT get this card">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {insights.avoid_for.map((u, i) => (
                        <div key={i} className="rounded-lg border bg-background p-3">
                          <div className="font-medium text-sm">{u.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">{u.detail}</div>
                        </div>
                      ))}
                    </div>
                  </InsightBlock>
                ) : null}

                {insights.community_sentiment && (
                  <InsightBlock icon={<Users className="w-4 h-4 text-primary" />} title="Community sentiment">
                    <p className="text-sm leading-relaxed">{insights.community_sentiment}</p>
                    <p className="text-[11px] text-muted-foreground mt-2 italic">
                      AI-synthesized general consensus. Not direct quotes from any platform.
                    </p>
                  </InsightBlock>
                )}

                {insights.alternatives?.length ? (
                  <InsightBlock icon={<Sparkles className="w-4 h-4 text-accent" />} title="Alternative cards to consider">
                    <div className="grid sm:grid-cols-3 gap-3">
                      {insights.alternatives.map((a) => (
                        <Link key={a.slug} to={`/card/${a.slug}`}>
                          <Card className="h-full hover:shadow-card transition">
                            <CardContent className="p-3">
                              <div className="font-medium text-sm">{a.name}</div>
                              <div className="text-xs text-muted-foreground mt-1">{a.why}</div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </InsightBlock>
                ) : null}
              </>
            )}
          </div>

          {/* Hall of Hacks */}
          <div className="rounded-xl border bg-gradient-to-br from-accent/10 via-background to-primary/5 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent/90 flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Hall of Hacks</h2>
                <p className="text-xs text-muted-foreground">Anonymized, AI-paraphrased community wisdom · no real users named</p>
              </div>
            </div>
            {loadingStories && <p className="text-sm text-muted-foreground">Cooking up some stories…</p>}
            {stories?.stories?.length ? (
              <div className="grid sm:grid-cols-3 gap-3">
                {stories.stories.map((s, i) => (
                  <div key={i} className="rounded-lg border bg-background p-4">
                    <Badge variant="outline" className="text-[10px] mb-2 capitalize">{s.vibe}</Badge>
                    <div className="font-semibold text-sm">{s.title}</div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{s.story}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-semibold mt-1 ${small ? "text-xs" : "text-base"}`}>{value}</div>
    </div>
  );
}
function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "warn" }) {
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${tone === "warn" ? "text-warning" : "text-muted-foreground"}`}>{title}</h2>
      {children}
    </div>
  );
}
function Field({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium mt-0.5">{v ?? "—"}</dd>
    </div>
  );
}
function InsightBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}<h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}
