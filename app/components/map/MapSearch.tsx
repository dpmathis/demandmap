"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin } from "lucide-react";

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
  type: string;
}

interface MapSearchProps {
  onFlyTo: (center: [number, number], zoom: number) => void;
}

export function MapSearch({ onFlyTo }: MapSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        setResults(d.results ?? []);
        setOpen(d.results?.length > 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 400);
  }

  function handleSelect(result: SearchResult) {
    onFlyTo([result.lng, result.lat], 15);
    setQuery(result.name.split(",")[0]);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search address or place..."
          className="w-full pl-7 pr-7 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 backdrop-blur"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white cursor-pointer"
          >
            <X size={10} />
          </button>
        )}
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-zinc-800/50 transition-colors cursor-pointer"
            >
              <MapPin size={10} className="text-teal-400 shrink-0" />
              <span className="text-[11px] text-zinc-300 truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
