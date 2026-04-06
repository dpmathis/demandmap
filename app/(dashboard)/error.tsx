"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-sm text-zinc-400">Something went wrong</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
