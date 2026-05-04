import { Sparkles, ShieldCheck, FileText, Users } from "lucide-react";

export default function About() {
  return (
    <section className="container py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold">About SwipeSutra</h1>
      <p className="text-muted-foreground mt-3 text-lg">
        Every Indian credit card — from your first lifetime-free card to ultra-luxury metal — decoded
        without the marketing fluff. Independent, ad-free, no affiliate links.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-10">
        <Box icon={<Sparkles className="w-5 h-5 text-primary" />} title="How insights are generated">
          Every card has a curated factual record. When you open a card, Google Gemini synthesizes
          "best for / not for / sentiment / alternatives" from that record + peer cards. Results are
          cached in our database for 30 days, then refreshed automatically on next view.
        </Box>
        <Box icon={<ShieldCheck className="w-5 h-5 text-success" />} title="Privacy & data">
          No login. No tracking. No personal data. Safe to share publicly on LinkedIn.
        </Box>
        <Box icon={<FileText className="w-5 h-5 text-accent-foreground" />} title="Source of truth">
          Each card links to the official issuing bank. Verify final numbers there before applying —
          banks change fees and terms frequently.
        </Box>
        <Box icon={<Users className="w-5 h-5 text-primary" />} title="Hall of Hacks — anonymized">
          The fun stories section is AI-paraphrased general community wisdom — never copied posts,
          screenshots, or usernames from Reddit, X, Facebook or any forum.
        </Box>
      </div>

      <h2 className="text-xl font-semibold mt-12">Disclaimer</h2>
      <p className="text-sm text-muted-foreground mt-2">
        SwipeSutra is not a regulated financial advisor and does not earn commission on any application.
        Information is provided "as is" and may be outdated. Nothing on this site is financial advice.
        Card visuals are generic mockups — all bank trademarks belong to their respective owners.
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
