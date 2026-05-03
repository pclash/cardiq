
## CardCompass India — AI-powered Credit Card Insights

A public, read-only web app that helps Indian users discover and understand credit cards. Content is generated on-demand by Lovable AI from a curated catalog of cards, with clear "AI-generated, verify on bank site" disclaimers and source links.

### Pages

1. **Home / Browse**
   - Hero with search bar ("Find a card by name, bank, or use case").
   - Filter sidebar: **Bank**, **Use case** (Travel, Fuel, Dining, Shopping, UPI, Lounge, Cashback, Business, Premium, Beginner), **Eligibility** (min income band, salaried/self-employed, student, credit score range), **Annual fee range**.
   - Grid of card cards: name, bank, network, joining/annual fee, top 3 perks, "View insights" CTA.
   - Sort: popularity, low fee, best rewards.

2. **Card detail page** (`/card/:slug`)
   - Header: card image placeholder, bank, network, fees, welcome benefit.
   - **Eligibility** section: income, age, employment, docs.
   - **Benefits** section: rewards rate, milestone, lounge, fuel surcharge, insurance.
   - **AI Insights** (loaded via edge function on demand, streamed):
     - Best use cases (where it shines)
     - Where it does NOT work / excluded categories (rent, wallet load, fuel, govt, etc.) and who shouldn't get it
     - Community sentiment summary (synthesized from public discussions, presented as general consensus, not direct quotes)
     - 3 alternative cards in same segment (links to those detail pages)
   - "Apply on bank site" outbound link (official bank URL only).
   - Disclaimer banner: "AI-generated summary. Verify all terms on the official bank website before applying."

3. **Compare** (`/compare?cards=a,b,c`)
   - Side-by-side table of up to 3 cards: fees, rewards, lounge, eligibility, best for.

4. **About / Methodology**
   - How insights are generated, sources, disclaimer, no affiliate/no data collection statement.

### Data model (Lovable Cloud)

Single `cards` table seeded with ~40-60 popular Indian cards:
```text
cards: id, slug, name, bank, network, joining_fee, annual_fee,
       fee_waiver_spend, reward_rate, welcome_benefit,
       use_cases (text[]), eligibility (jsonb: min_income, employment, age),
       key_benefits (text[]), excluded_categories (text[]),
       official_url, popularity_rank
ai_insights_cache: card_id, insights_json, generated_at
```
No user accounts, no PII collected.

### AI integration

- Edge function `generate-insights` calls Lovable AI (`google/gemini-3-flash-preview`) with the card's structured data + a strict system prompt:
  - Output structured JSON (best_use_cases, avoid_for, excluded_categories, sentiment_summary, alternatives).
  - Cache result in `ai_insights_cache` for 30 days to control cost.
  - Handle 429/402 with friendly toasts.
- Prompt explicitly instructs the model to:
  - Avoid quoting individuals or copying text from Reddit/X/Facebook.
  - Synthesize general consensus only.
  - Flag uncertainty rather than invent numbers.
  - Never include personal data.

### Privacy & legal safety

- No scraping of Reddit/X/Facebook (TOS + copyright risk). Insights are AI-synthesized in the model's own words — no user quotes, no usernames, no screenshots.
- All factual fee/benefit data sourced from public bank pages; each card links to its **official bank URL** as the source of truth.
- Visible disclaimer on every card page: "Information may be outdated or AI-generated. Always verify with the issuing bank."
- No login, no analytics beyond basic page views, no cookies beyond essentials — safe to share on LinkedIn.

### Design

- Clean, professional, finance-product feel: white background, deep indigo primary, soft card shadows, rounded-xl, Inter font.
- Mobile-first (you'll share on LinkedIn → many mobile readers).
- Card thumbnails as gradient placeholders (avoids using bank trademark images).

### Build sequence

1. Enable Lovable Cloud + AI; create `cards` and `ai_insights_cache` tables; seed ~40 cards via migration.
2. Build Browse page with filters + card grid.
3. Build Card detail page with static sections.
4. Build `generate-insights` edge function + caching; wire into detail page with streaming UI.
5. Build Compare page.
6. About/Methodology page, global disclaimer footer, LinkedIn-friendly OG meta tags.

### Out of scope (v1)

- User accounts, favorites, application tracking, affiliate links, real-time scraping, image uploads of actual card art.
