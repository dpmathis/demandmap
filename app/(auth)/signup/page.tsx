"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Coffee,
  Lock,
  Mail,
  Map as MapIcon,
  Megaphone,
  Store,
  Truck,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase/client";
import { AuthMapTeaser } from "@/app/components/auth/AuthMapTeaser";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError("Account created but email confirmation may be required. Check Supabase settings.");
      setLoading(false);
      return;
    }

    router.push("/onboarding");
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-zinc-950 lg:flex-row">
      {/* Left: form column */}
      <div className="relative z-20 flex h-full w-full flex-col justify-between overflow-y-auto border-r border-zinc-800/80 bg-[#0a0f1e] p-8 shadow-[20px_0_40px_rgba(0,0,0,0.5)] lg:w-[40%] lg:p-12 xl:w-[35%] xl:p-16">
        {/* Soft teal glow */}
        <div className="pointer-events-none absolute left-0 top-0 h-1/2 w-full bg-teal-900/10 blur-[100px]" />

        {/* Brand header */}
        <header className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 shadow-[0_0_15px_rgba(20,184,166,0.1)]">
            <MapIcon className="h-5 w-5 text-teal-500" strokeWidth={2} />
          </div>
          <span className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight text-zinc-100">DemandMap</span>
            <span className="font-mono text-xs text-zinc-500">NYC</span>
          </span>
        </header>

        {/* Form body */}
        <main className="relative z-10 my-auto w-full max-w-sm py-12">
          <div className="mb-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 font-mono text-[10px] tracking-wider text-teal-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
              NEW OPERATOR REGISTRATION
            </div>
            <h1 className="mb-4 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white lg:text-5xl">
              Start routing by
              <br />
              <span className="bg-gradient-to-r from-teal-400 to-teal-600 bg-clip-text text-transparent">
                real demand
              </span>
              , not guesses.
            </h1>
            <p className="mb-8 text-sm font-light leading-relaxed text-zinc-400">
              Create your account and plan profitable weeks across NYC using
              live foot traffic, weather, and event signals tuned to your
              vertical.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-4">
              <div className="group relative">
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail
                    className="h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-teal-400"
                    strokeWidth={2}
                  />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="block w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5 pl-10 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-all focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div className="group relative">
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock
                    className="h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-teal-400"
                    strokeWidth={2}
                  />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6+ characters"
                  required
                  minLength={6}
                  className="block w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5 pl-10 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-all focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-5 py-3.5 text-center text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all hover:-translate-y-0.5 hover:bg-teal-400 hover:shadow-[0_0_25px_rgba(20,184,166,0.5)] focus:outline-none focus:ring-4 focus:ring-teal-500/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {loading ? "Creating account..." : "Create account"}
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </form>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-zinc-800/80 pt-6 sm:flex-row sm:items-center">
            <span className="text-xs text-zinc-500">Already have an account?</span>
            <Link
              href="/login"
              className="border-b border-zinc-700 pb-0.5 text-sm font-medium text-white transition-colors hover:border-teal-400 hover:text-teal-400"
            >
              Sign in
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-4 font-mono text-xs text-zinc-500">
            <span className="tracking-wider">VERTICALS SERVED:</span>
            <div className="flex items-center gap-3 text-zinc-400">
              <Coffee className="h-3.5 w-3.5" strokeWidth={2} aria-label="Coffee" />
              <Truck className="h-3.5 w-3.5" strokeWidth={2} aria-label="Food" />
              <Store className="h-3.5 w-3.5" strokeWidth={2} aria-label="Retail" />
              <Megaphone className="h-3.5 w-3.5" strokeWidth={2} aria-label="Canvassers" />
            </div>
          </div>
          <div className="flex w-full justify-between font-mono text-[10px] tracking-wider text-zinc-600">
            <span>SECURE CONNECTION</span>
            <span>NYC REGION ONLY</span>
          </div>
        </footer>
      </div>

      {/* Right: immersive map teaser */}
      <AuthMapTeaser />
    </div>
  );
}
