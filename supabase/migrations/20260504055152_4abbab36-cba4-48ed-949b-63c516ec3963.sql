CREATE TABLE IF NOT EXISTS public.card_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  stories jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id)
);

ALTER TABLE public.card_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stories are publicly readable"
ON public.card_stories FOR SELECT
USING (true);