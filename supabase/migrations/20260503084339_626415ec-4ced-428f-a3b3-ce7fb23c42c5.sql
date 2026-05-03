
CREATE TABLE public.cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  bank text NOT NULL,
  network text NOT NULL,
  joining_fee integer NOT NULL DEFAULT 0,
  annual_fee integer NOT NULL DEFAULT 0,
  fee_waiver_spend integer,
  reward_rate text,
  welcome_benefit text,
  use_cases text[] NOT NULL DEFAULT '{}',
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  key_benefits text[] NOT NULL DEFAULT '{}',
  excluded_categories text[] NOT NULL DEFAULT '{}',
  tagline text,
  best_for text,
  official_url text,
  popularity_rank integer NOT NULL DEFAULT 999,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cards_bank ON public.cards(bank);
CREATE INDEX idx_cards_popularity ON public.cards(popularity_rank);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cards are publicly readable"
ON public.cards FOR SELECT
USING (true);

CREATE TABLE public.ai_insights_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  insights jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id)
);

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insights are publicly readable"
ON public.ai_insights_cache FOR SELECT
USING (true);
