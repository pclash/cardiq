import { Sparkles, ShieldCheck, FileText, Users } from "lucide-react";

export default function About() {
  return (
    <section className="container py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold">About CardCompass India</h1>
      <p className="text-muted-foreground mt-3 text-lg">
        An independent, ad-free, no-affiliate guide to credit cards in India — built to help you actually understand a card before you apply.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-10">
        <Box icon={<Sparkles className="w-5 h-5 text-primary" />} title="How insights are generated">
          Every card has a curated factual record (fees, benefits, eligibility, exclusions). When you open a card,
          AI synthesizes "best for / not for / community sentiment / alternatives" using only that record and a list of
          peer cards. Insights are cached for ~30 days.
        </Box>
        <Box icon={<ShieldCheck className="w-5 h-5 text-success" />} title="Privacy & data">
          No login. No analytics tracking you across the web. No personal data stored. Safe to share publicly on LinkedIn.
        </Box>
        <Box icon={<FileText className="w-5 h-5 text-accent-foreground" />} title="Source of truth">
          Each card links to the official issuing bank's product page. Always verify final numbers there before applying —
          banks change fees and terms frequently.
        </Box>
        <Box icon={<Users className="w-5 h-5 text-primary" />} title="No quotes from social platforms">
          We never copy posts, screenshots, or usernames from Reddit, X, Facebook or any community. "Community sentiment"
          is the AI's neutral synthesis of generally known patterns about a card category.
        </Box>
      </div>

      <h2 className="text-xl font-semibold mt-12">Disclaimer</h2>
      <p className="text-sm text-muted-foreground mt-2">
        CardCompass India is not a regulated financial advisor and does not earn commission on any application. Information is
        provided "as is" and may be outdated, incomplete, or inaccurate. Nothing on this site constitutes financial advice.
        All trademarks belong to their respective owners.
      </p>
    </section>
  );
}

function Box({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-5 bg-card">
      <div className="flex items-center gap-2 mb-2">{icon}<h3 className="font-semibold">{title}</h3></div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
