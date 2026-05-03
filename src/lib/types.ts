export type Card = {
  id: string;
  slug: string;
  name: string;
  bank: string;
  network: string;
  joining_fee: number;
  annual_fee: number;
  fee_waiver_spend: number | null;
  reward_rate: string | null;
  welcome_benefit: string | null;
  use_cases: string[];
  eligibility: { min_income?: string; employment?: string; age?: string };
  key_benefits: string[];
  excluded_categories: string[];
  tagline: string | null;
  best_for: string | null;
  official_url: string | null;
  popularity_rank: number;
};

export type Insights = {
  best_use_cases?: { title: string; detail: string }[];
  avoid_for?: { title: string; detail: string }[];
  excluded_categories?: string[];
  community_sentiment?: string;
  alternatives?: { slug: string; name: string; why: string }[];
};
