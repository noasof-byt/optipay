"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  initialValue?: string;
}

export function SearchBar({ initialValue = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function handleClear() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="relative" role="search">
      <div
        className={cn(
          "flex items-center gap-2 bg-white rounded-2xl px-4 py-3 transition-shadow duration-200",
          focused ? "shadow-float ring-2 ring-brand-500" : "shadow-card"
        )}
      >
        {/* Search icon */}
        <Search size={20} className="text-ink-faint shrink-0" aria-hidden="true" />

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          dir="auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="חפש מוצר, חנות, או מותג..."
          className={cn(
            "flex-1 bg-transparent text-ink text-sm font-medium",
            "placeholder:text-ink-faint",
            "outline-none border-none focus:ring-0"
          )}
          aria-label="חיפוש מוצרים"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />

        {/* Clear / Mic */}
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 p-1 rounded-lg text-ink-faint hover:text-ink transition-colors"
            aria-label="נקה חיפוש"
          >
            <X size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 p-1 rounded-lg text-ink-faint hover:text-brand-500 transition-colors"
            aria-label="חיפוש קולי"
          >
            <Mic size={18} />
          </button>
        )}
      </div>

      {/* Hidden submit for keyboard "search" action */}
      <button type="submit" className="sr-only">חפש</button>
    </form>
  );
}
