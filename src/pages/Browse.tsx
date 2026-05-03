import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Card as CardT } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import CardThumb from "@/components/CardThumb";
import { Search, ArrowRight, Sparkles } from "lucide-react";

const USE_CASES = ["Travel","Lounge","Cashback","Dining","Shopping","Fuel","UPI","Premium","Beginner","Online","Airline","Lifetime-free","Entertainment","Bills"];
const INCOME_BANDS = [
  { label: "< 6 LPA", test: (s = "") => /(\b3 LPA|\b2\.5|\b4 LPA|FD-backed|Anyone)/i.test(s) },
  { label: "6 – 12 LPA", test: (s = "") => /6 LPA|7 LPA|9 LPA/i.test(s) },
  { label: "12 – 24 LPA", test: (s = "") => /12 LPA|15 LPA/i.test(s) },
  { label: "24+ LPA", test: (s = "") => /(24 LPA|25 LPA|30 LPA|36 LPA|42 LPA|Burgundy|Premier)/i.test(s) },
];

export default function Browse() {
  const [cards, setCards] = useState<CardT[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [banks, setBanks] = useState<string[]>([]);
  const [useCases, setUseCases] = useState<string[]>([]);
  const [income, setIncome] = useState<string | null>(null);
  const [sort, setSort] = useState<"popularity" | "fee_low" | "fee_high">("popularity");

  useEffect(() => {
    supabase.from("cards").select("*").order("popularity_rank").then(({ data }) => {
      setCards((data ?? []) as CardT[]);
      setLoading(false);
    });
  }, []);

  const allBanks = useMemo(() => Array.from(new Set(cards.map(c => c.bank))).sort(), [cards]);

  const filtered = useMemo(() => {
    let r = cards;
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(c => c.name.toLowerCase().includes(t) || c.bank.toLowerCase().includes(t)
        || c.use_cases.some(u => u.toLowerCase().includes(t)) || (c.best_for ?? "").toLowerCase().includes(t));
    }
    if (banks.length) r = r.filter(c => banks.includes(c.bank));
    if (useCases.length) r = r.filter(c => useCases.some(u => c.use_cases.includes(u)));
    if (income) {
      const band = INCOME_BANDS.find(b => b.label === income);
      if (band) r = r.filter(c => band.test(c.eligibility?.min_income));
    }
    if (sort === "fee_low") r = [...r].sort((a, b) => a.annual_fee - b.annual_fee);
    if (sort === "fee_high") r = [...r].sort((a, b) => b.annual_fee - a.annual_fee);
    return r;
  }, [cards, q, banks, useCases, income, sort]);

  const toggle = (set: string[], v: string, fn: (x: string[]) => void) =>
    fn(set.includes(v) ? set.filter(x => x !== v) : [...set, v]);

  return (
    <>
      <section className="gradient-hero text-white">
        <div className="container py-16 md:py-20">
          <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 mb-4">
            <Sparkles className="w-3 h-3 mr-1" /> AI-powered insights
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold max-w-3xl">
            Find the right Indian credit card — without the marketing fluff.
          </h1>
          <p className="mt-4 text-lg text-white/85 max-w-2xl">
            {cards.length}+ cards, filtered by bank, use case and eligibility. With honest "where it doesn't work" sections you won't find on bank sites.
          </p>
          <div className="mt-6 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by card, bank, or use case (e.g. travel, fuel)..."
              className="pl-10 h-12 bg-white text-foreground border-0" />
          </div>
        </div>
      </section>

      <section className="container py-10 grid lg:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-6 lg:sticky lg:top-20 self-start">
          <div>
            <h3 className="text-sm font-semibold mb-3">Bank</h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-2">
              {allBanks.map(b => (
                <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={banks.includes(b)} onCheckedChange={() => toggle(banks, b, setBanks)} />
                  <span>{b}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Use case</h3>
            <div className="flex flex-wrap gap-2">
              {USE_CASES.map(u => (
                <button key={u} onClick={() => toggle(useCases, u, setUseCases)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    useCases.includes(u) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"
                  }`}>{u}</button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Income (eligibility)</h3>
            <div className="space-y-2">
              {INCOME_BANDS.map(b => (
                <label key={b.label} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={income === b.label}
                    onCheckedChange={() => setIncome(income === b.label ? null : b.label)} />
                  <span>{b.label}</span>
                </label>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full"
            onClick={() => { setBanks([]); setUseCases([]); setIncome(null); setQ(""); }}>
            Reset filters
          </Button>
        </aside>

        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{filtered.length} cards</p>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
              className="text-sm border rounded-md px-3 py-1.5 bg-background">
              <option value="popularity">Most popular</option>
              <option value="fee_low">Lowest fee</option>
              <option value="fee_high">Highest fee</option>
            </select>
          </div>

          {loading ? (
            <div className="text-muted-foreground text-sm">Loading cards…</div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map(c => (
                <Link key={c.id} to={`/card/${c.slug}`}>
                  <Card className="hover:shadow-elevated transition-shadow h-full">
                    <CardContent className="p-5 space-y-4">
                      <CardThumb name={c.name} bank={c.bank} />
                      <div>
                        <h3 className="font-semibold leading-tight">{c.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.bank} · {c.network}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.use_cases.slice(0, 3).map(u => (
                          <Badge key={u} variant="secondary" className="text-[10px] font-normal">{u}</Badge>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs pt-2 border-t">
                        <div>
                          <div className="text-muted-foreground">Annual fee</div>
                          <div className="font-semibold text-foreground">
                            {c.annual_fee === 0 ? "Free" : `₹${c.annual_fee.toLocaleString("en-IN")}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">Best for</div>
                          <div className="font-medium text-foreground line-clamp-1 max-w-[140px]">{c.best_for ?? "—"}</div>
                        </div>
                      </div>
                      <div className="flex items-center text-primary text-xs font-medium pt-1">
                        View insights <ArrowRight className="w-3 h-3 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              No cards match these filters. Try resetting.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
