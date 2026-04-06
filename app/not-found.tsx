import Link from "next/link";

export default function NotFound() {
  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white">
      <p className="text-6xl font-mono font-bold text-zinc-800 mb-4">404</p>
      <p className="text-sm text-zinc-500 mb-6">Page not found</p>
      <Link
        href="/"
        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
