import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

// Curated source URLs per bank — official listing pages preferred, aggregator fallbacks.
const BANK_SOURCES: { bank: string; urls: string[] }[] = [
  { bank: "HDFC Bank", urls: ["https://www.hdfcbank.com/personal/pay/cards/credit-cards", "https://www.paisabazaar.com/hdfc-bank-credit-card/"] },
  { bank: "SBI Card", urls: ["https://www.sbicard.com/en/personal/credit-cards.page", "https://www.paisabazaar.com/sbi-credit-card/"] },
  { bank: "Axis Bank", urls: ["https://www.axisbank.com/retail/cards/credit-card", "https://www.paisabazaar.com/axis-bank-credit-card/"] },
  { bank: "ICICI Bank", urls: ["https://www.icicibank.com/personal-banking/cards/credit-card", "https://www.paisabazaar.com/icici-bank-credit-card/"] },
  { bank: "American Express", urls: ["https://www.americanexpress.com/in/credit-cards/", "https://www.paisabazaar.com/american-express-credit-card/"] },
  { bank: "IDFC FIRST Bank", urls: ["https://www.idfcfirstbank.com/credit-card", "https://www.paisabazaar.com/idfc-first-bank-credit-card/"] },
  { bank: "Kotak Mahindra Bank", urls: ["https://www.kotak.com/en/personal-banking/cards/credit-cards.html", "https://www.paisabazaar.com/kotak-mahindra-bank-credit-card/"] },
  { bank: "RBL Bank", urls: ["https://www.rblbank.com/category/credit-cards", "https://www.paisabazaar.com/rbl-bank-credit-card/"] },
  { bank: "AU Small Finance Bank", urls: ["https://www.aubank.in/personal-banking/cards/credit-cards", "https://www.paisabazaar.com/au-small-finance-bank-credit-card/"] },
  { bank: "IndusInd Bank", urls: ["https://www.indusind.com/in/en/personal/cards/credit-card.html", "https://www.paisabazaar.com/indusind-bank-credit-card/"] },
  { bank: "Yes Bank", urls: ["https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards", "https://www.paisabazaar.com/yes-bank-credit-card/"] },
  { bank: "Standard Chartered", urls: ["https://www.sc.com/in/credit-cards/", "https://www.paisabazaar.com/standard-chartered-credit-card/"] },
  { bank: "HSBC India", urls: ["https://www.hsbc.co.in/credit-cards/", "https://www.paisabazaar.com/hsbc-credit-card/"] },
  { bank: "Federal Bank", urls: ["https://www.federalbank.co.in/credit-cards", "https://www.paisabazaar.com/federal-bank-credit-card/"] },
  { bank: "Bank of Baroda", urls: ["https://www.bobfinancial.com/credit-cards.jsp", "https://www.paisabazaar.com/bank-of-baroda-credit-card/"] },
  { bank: "Canara Bank", urls: ["https://canarabank.com/pages/credit-cards", "https://www.paisabazaar.com/canara-bank-credit-card/"] },
  { bank: "Punjab National Bank", urls: ["https://www.pnbindia.in/credit-card.html", "https://www.paisabazaar.com/pnb-credit-card/"] },
  { bank: "IDBI Bank", urls: ["https://www.idbibank.in/credit-card.aspx"] },
  { bank: "Union Bank", urls: ["https://www.unionbankofindia.co.in/english/credit-cards.aspx"] },
  { bank: "Bank of India", urls: ["https://bankofindia.co.in/credit-cards"] },
  { bank: "Central Bank", urls: ["https://www.centralbankofindia.co.in/en/credit-cards"] },
  { bank: "OneCard (FPL)", urls: ["https://www.getonecard.app/", "https://www.paisabazaar.com/onecard-credit-card/"] },
  { bank: "Slice", urls: ["https://www.sliceit.com/"] },
  { bank: "Tata Neu / Tata Capital", urls: ["https://www.tatacapital.com/credit-cards.html"] },
  { bank: "BPI / Other aggregator", urls: ["https://www.cardinsider.com/credit-cards/"] },
];

type RunResult = { bank: string; ok: boolean; upserted?: number; log?: string[]; error?: string };

export default function AdminSeed() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [active, setActive] = useState<string | null>(null);

  async function runOne(bank: string, urls: string[]) {
    setActive(bank);
    const { data, error } = await supabase.functions.invoke("seed-cards", { body: { bank, urls } });
    const r: RunResult = error
      ? { bank, ok: false, error: error.message }
      : { bank, ok: !!data?.ok, upserted: data?.upserted, log: data?.log, error: data?.error };
    setResults((prev) => [r, ...prev]);
    setActive(null);
  }

  async function runAll() {
    setRunning(true);
    setResults([]);
    for (const src of BANK_SOURCES) {
      await runOne(src.bank, src.urls);
    }
    setRunning(false);
  }

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin · Seed Cards</h1>
        <p className="text-muted-foreground mt-1">
          Scrapes each bank's listing via Firecrawl, extracts card data with Gemini, upserts into the database. Run once,
          then again every 30 days.
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={runAll} disabled={running}>
          {running ? `Running… ${active ?? ""}` : "Seed ALL banks"}
        </Button>
      </div>

      <div className="grid gap-3">
        {BANK_SOURCES.map((src) => (
          <Card key={src.bank} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{src.bank}</div>
              <div className="text-xs text-muted-foreground">{src.urls.length} source(s)</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={running || active === src.bank}
              onClick={() => runOne(src.bank, src.urls)}
            >
              {active === src.bank ? "Running…" : "Seed"}
            </Button>
          </Card>
        ))}
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Results</h2>
          {results.map((r, i) => (
            <Card key={i} className="p-4">
              <div className="flex justify-between">
                <span className="font-medium">{r.bank}</span>
                <span className={r.ok ? "text-green-600" : "text-destructive"}>
                  {r.ok ? `✓ ${r.upserted} upserted` : `✗ ${r.error}`}
                </span>
              </div>
              {r.log && (
                <pre className="text-xs mt-2 bg-muted p-2 rounded overflow-auto max-h-40">{r.log.join("\n")}</pre>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
