import { Suspense } from "react";
import { Metadata } from "next";
import { SearchResultsView } from "@/components/search/SearchResultsView";
import { SearchBar } from "@/components/search/SearchBar";

export const metadata: Metadata = { title: "תוצאות חיפוש" };

// Force dynamic — results always depend on the query string
export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string };
}

export default function SearchPage({ searchParams }: Props) {
  const query = searchParams.q?.trim() ?? "";

  return (
    <div className="page-container py-4 space-y-4">
      {/* Persistent search bar on results page */}
      <SearchBar initialValue={query} />

      {query ? (
        <Suspense fallback={<SearchSkeleton />}>
          <SearchResultsView query={query} />
        </Suspense>
      ) : (
        <div className="text-center py-16">
          <p className="text-ink-muted text-sm">הזן מונח חיפוש למעלה</p>
        </div>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card h-28 bg-surface-muted" />
      ))}
    </div>
  );
}
