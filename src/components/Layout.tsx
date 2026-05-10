import { Link, Outlet, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function Layout() {
  const { pathname } = useLocation();
  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors hover:text-primary ${
        pathname === to ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-card flex items-center justify-center shadow-card">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Card<span className="text-primary">IQ</span></span>
          </Link>
          <nav className="flex items-center gap-6">
            {navLink("/compare", "Compare")}
            {navLink("/about", "About")}
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t mt-12 bg-secondary/30">
        <div className="container py-8 text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">CardIQ · smart intelligence on Indian credit cards</p>
          <p>
            CardIQ is an independent, non-affiliated guide. Card details and AI-generated insights
            are for guidance only and may be outdated. Always verify fees, benefits and eligibility on
            the official issuing bank's website before applying.
          </p>
          <p>No affiliate links · No personal data collected · Not financial advice.</p>
          <p className="pt-2">© {new Date().getFullYear()} CardIQ</p>
        </div>
      </footer>
    </div>
  );
}
