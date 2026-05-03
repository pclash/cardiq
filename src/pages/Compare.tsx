import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Card as CardT } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import CardThumb from "@/components/CardThumb";

export default function Compare() {
  const [cards, setCards] = useState<CardT[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("cards").select("*").order("popularity_rank").then(({ data }) => setCards((data ?? []) as CardT[]));
  }, []);

  const selected = useMemo(() => picked.map(id => cards.find(c => c.id === id)).filter(Boolean) as CardT[], [picked, cards]);

  const add = (id: string) => setPicked(p => p.includes(id) ? p : p.length >= 3 ? p : [...p, id]);
  const remove = (id: string) => setPicked(p => p.filter(x => x !== id));

  return (
    <section className="container py-10">
      <h1 className="text-3xl font-bold">Compare cards</h1>
      <p className="text-muted-foreground mt-1">Pick up to 3 cards to compare side-by-side.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <select onChange={(e) => { add(e.target.value); e.currentTarget.value = ""; }}
          className="border rounded-md px-3 py-2 text-sm bg-background" defaultValue="">
          <option value="" disabled>+ Add a card…</option>
          {cards.filter(c => !picked.includes(c.id)).map(c => (
            <option key={c.id} value={c.id}>{c.name} — {c.bank}</option>
          ))}
        </select>
      </div>

      {selected.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground">No cards selected yet.</div>
      ) : (
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {selected.map(c => (
            <div key={c.id} className="border rounded-xl p-5 space-y-4 bg-card relative">
              <button onClick={() => remove(c.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
              <CardThumb name={c.name} bank={c.bank} />
              <div>
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-xs text-muted-foreground">{c.bank} · {c.network}</p>
              </div>
              <Row k="Annual fee" v={c.annual_fee === 0 ? "Free" : `₹${c.annual_fee.toLocaleString("en-IN")}`} />
              <Row k="Joining fee" v={c.joining_fee === 0 ? "Free" : `₹${c.joining_fee.toLocaleString("en-IN")}`} />
              <Row k="Fee waiver" v={c.fee_waiver_spend ? `₹${c.fee_waiver_spend.toLocaleString("en-IN")}` : "—"} />
              <Row k="Rewards" v={c.reward_rate ?? "—"} />
              <Row k="Min income" v={c.eligibility?.min_income ?? "—"} />
              <Row k="Best for" v={c.best_for ?? "—"} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Use cases</div>
                <div className="flex flex-wrap gap-1">
                  {c.use_cases.map(u => <Badge key={u} variant="secondary" className="text-[10px]">{u}</Badge>)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-warning mb-1">Doesn't work for</div>
                <div className="flex flex-wrap gap-1">
                  {c.excluded_categories.map(u => <Badge key={u} variant="outline" className="text-[10px] border-warning/40 text-warning">{u}</Badge>)}
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={`/card/${c.slug}`}>View full details</a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm py-2 border-b last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right max-w-[60%]">{v}</span>
    </div>
  );
}
