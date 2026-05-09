# Rewrite README.md

Replace the current generic Vite/Lovable README with a project-specific guide that explains what this app actually does and how all the moving pieces fit together.

## New README sections

1. **Project overview** — "Indian Credit Card Explorer": browse, compare, and get AI insights on 100+ Indian credit cards across 16 banks.

2. **Key features**
   - Browse & search 108 cards (Axis, HDFC, ICICI, IndusInd, IDFC FIRST, Kotak, Amex, SBI, etc.)
   - Card detail pages with AI-generated insights and stories
   - Side-by-side card comparison
   - Admin seeder to ingest new cards from bank/aggregator URLs

3. **Tech stack**
   - React 18 + Vite + TypeScript + Tailwind + shadcn/ui
   - Lovable Cloud (Supabase) for database, auth, edge functions
   - Lovable AI Gateway (`google/gemini-3-flash-preview`) for content generation
   - Firecrawl for scraping bank/aggregator pages

4. **Database tables**
   - `cards` — card catalog (name, bank, fees, rewards, eligibility, benefits)
   - `ai_insights_cache` — cached AI insights per card (generated once, reused forever)
   - `card_stories` — cached AI-generated story snippets per card
   - All tables are publicly readable; writes happen only through edge functions

5. **Edge functions** (`supabase/functions/`)
   - `seed-cards` — Firecrawl + AI extraction pipeline that populates the `cards` table
   - `generate-insights` — on-demand AI insights for a card, cached in `ai_insights_cache`
   - `generate-stories` — on-demand story snippets, cached in `card_stories`
   - `prewarm-cache` — bulk-generate insights/stories for all cards

6. **Pages** (`src/pages/`)
   - `Index` — landing page
   - `Browse` — searchable card list
   - `CardDetail` — single card view with AI insights
   - `Compare` — side-by-side comparison
   - `AdminSeed` — trigger seeding from the UI
   - `About`, `NotFound`

7. **Caching strategy** — short paragraph: AI runs once per card, results stored in DB, every subsequent view is a pure DB read (no API cost).

8. **Local development** — keep the existing `npm i` / `npm run dev` block but trim the marketing fluff.

9. **Deployment & GitHub** — short note: edits in Lovable auto-push to GitHub; pushes to GitHub auto-sync back. Publish via Lovable's Publish button.

## Out of scope

- No code changes, no schema changes, no edge function changes.
- Only `README.md` is touched.
