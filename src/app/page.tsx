import { SearchBar } from "@/components/search/SearchBar";
import { QuickBenefitsStrip } from "@/components/wallet/QuickBenefitsStrip";
import { RecentSearches } from "@/components/search/RecentSearches";
import { SavingsSummaryCard } from "@/components/dashboard/SavingsSummaryCard";
import { HomeGreeting } from "@/components/layout/HomeGreeting";

/**
 * Home page — the main entry point.
 * Mobile-first: search bar is prominent, recent history below,
 * quick wallet strip shows active cards/clubs at a glance.
 */
export default function HomePage() {
  return (
    <div className="page-container py-4 space-y-5">
      {/* ── Hero greeting + search ── */}
      <section>
        <div className="gradient-header rounded-3xl p-5 pb-8 mb-[-1.5rem] text-white">
          <HomeGreeting />
          {/* Search bar sits over the gradient card bottom edge */}
          <SearchBar />
        </div>
      </section>

      {/* ── Quick benefits strip (active cards / clubs) ── */}
      <section className="pt-3">
        <h2 className="section-title">הארנק שלי</h2>
        <QuickBenefitsStrip />
      </section>

      {/* ── Monthly savings summary ── */}
      <section>
        <h2 className="section-title">החיסכון שלי</h2>
        <SavingsSummaryCard />
      </section>

      {/* ── Recent searches ── */}
      <section>
        <h2 className="section-title">חיפושים אחרונים</h2>
        <RecentSearches />
      </section>
    </div>
  );
}
