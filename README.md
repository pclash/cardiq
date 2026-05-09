# Indian Credit Card Explorer

Browse, compare, and get AI‑generated insights on 100+ Indian credit cards across 16 banks (Axis, HDFC, ICICI, IndusInd, IDFC FIRST, Kotak, Amex, SBI, and more).

---

## Features

- **Browse & search** every card in the database with instant filtering.
- **Card detail pages** with AI‑generated insights, pros/cons, and short story snippets.
- **Side‑by‑side comparison** of multiple cards (fees, rewards, benefits).
- **Admin seeder** that ingests new cards from official bank pages and aggregator URLs (Paisabazaar, BankBazaar, etc.) using Firecrawl + AI extraction.

---

## Tech stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Lovable Cloud (managed Supabase) — Postgres, RLS, edge functions
- **AI:** Lovable AI Gateway with `google/gemini-3-flash-preview` (no separate API key needed)
- **Scraping:** Firecrawl (via the Lovable Firecrawl connector)

---

## Database tables

All tables are publicly **readable**. Writes only happen through edge functions (service role).

| Table | Purpose |
|---|---|
| `cards` | Card catalog — name, bank, network, fees, rewards, eligibility, benefits, use cases |
| `ai_insights_cache` | Cached AI insights per card. Generated once, reused forever. |
| `card_stories` | Cached AI‑generated story snippets per card. |

> **Caching strategy:** AI is called at most **once per card**. The result is written to the DB, and every subsequent view is a pure DB read — no AI cost, no latency.

---

## Edge functions (`supabase/functions/`)

| Function | What it does |
|---|---|
| `seed-cards` | Firecrawl scrape → AI extract → insert into `cards`. Drives the seeder. |
| `generate-insights` | On‑demand AI insights for a single card; cached in `ai_insights_cache`. |
| `generate-stories` | On‑demand short stories for a card; cached in `card_stories`. |
| `prewarm-cache` | Bulk‑generates insights + stories for every card so users never wait. |

Edge functions deploy automatically on every change — no manual deploy step.

---

## Pages (`src/pages/`)

| Route | File | Purpose |
|---|---|---|
| `/` | `Index.tsx` | Landing page |
| `/browse` | `Browse.tsx` | Searchable list of all cards |
| `/card/:slug` | `CardDetail.tsx` | Full card view with AI insights & stories |
| `/compare` | `Compare.tsx` | Side‑by‑side comparison |
| `/admin/seed` | `AdminSeed.tsx` | Trigger the seeder from the UI |
| `/about` | `About.tsx` | About the project |
| `*` | `NotFound.tsx` | 404 |

---

## Local development

```sh
npm install
npm run dev
```

The `.env` file (Supabase URL + anon key) is auto‑managed by Lovable Cloud — don't edit it manually.

---

## Deployment & GitHub sync

- **Two‑way GitHub sync:** changes made in Lovable auto‑push to your connected GitHub repo, and commits pushed to GitHub auto‑sync back into Lovable. No manual pull/push.
- **Publish:** click the **Publish** button (top right of the Lovable editor) to deploy a public URL.
- **View DB data:** open **Cloud → Database → Tables** in the Lovable editor.
