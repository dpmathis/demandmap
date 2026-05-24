"use client";

import { useState } from "react";
import { X, Check, Sparkles, MapPin, Route, Calendar, Brain, Film, Scale, Save, Download, BarChart3, Users, Bell } from "lucide-react";
import { useSubscription } from "@/app/lib/context/SubscriptionContext";
import { tapHaptic, notificationHaptic } from "@/app/lib/haptics";

type Plan = "monthly" | "annual";

const FEATURES = [
  { icon: MapPin, label: "Block-level demand scores" },
  { icon: Route, label: "Route Builder" },
  { icon: Calendar, label: "Weekly Planner" },
  { icon: Brain, label: "AI Suggestions" },
  { icon: Film, label: "Time Lapse" },
  { icon: Scale, label: "Block Comparison (up to 3)" },
  { icon: Save, label: "Saved Views" },
  { icon: Download, label: "CSV Export" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Users, label: "Team Collaboration" },
  { icon: Bell, label: "Push Notifications & Route Alerts" },
];

const PRICING = {
  monthly: { price: "$7.99", period: "/mo", note: "Billed monthly" },
  annual: { price: "$59.99", period: "/yr", note: "Save $36 vs monthly" },
};

export function Paywall() {
  const { paywallOpen, paywallFeature, hidePaywall, refresh } = useSubscription();
  const [plan, setPlan] = useState<Plan>("annual");
  const [purchasing, setPurchasing] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  if (!paywallOpen) return null;

  async function handleStartTrial() {
    tapHaptic("medium");
    setPurchasing(true);
    setRestoreError(null);

    try {
      // TODO: wire up @revenuecat/purchases-capacitor once App Store products
      // are created. Until then, this surfaces the pending state so the rest
      // of the UI is testable.
      await new Promise((r) => setTimeout(r, 500));
      setRestoreError(
        "Subscription products are being set up in App Store Connect. " +
        "We will email you when the trial is available.",
      );
      notificationHaptic("warning");
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    tapHaptic("light");
    setRestoreError(null);
    // TODO: Purchases.restorePurchases() via @revenuecat/purchases-capacitor
    await refresh();
  }

  const featureLabel = paywallFeature ? `Unlock ${paywallFeature}` : "Unlock DemandMap Pro";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={hidePaywall}
      />
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90dvh] overflow-y-auto pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-6">
        <div className="px-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-teal-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">DemandMap Pro</span>
            </div>
            <button
              onClick={hidePaywall}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-zinc-400 hover:text-white"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight mb-1">
            {featureLabel}
          </h2>
          <p className="text-sm text-zinc-400 mb-5">
            7-day free trial, cancel anytime in App Store settings.
          </p>

          {/* Features list */}
          <ul className="space-y-2.5 mb-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-teal-400" />
                  </span>
                  <span className="text-sm text-zinc-200">{f.label}</span>
                  <Check size={14} className="ml-auto text-teal-500" />
                </li>
              );
            })}
          </ul>

          {/* Plan toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { tapHaptic("light"); setPlan("annual"); }}
              className={`flex-1 px-3 py-3 rounded-xl border text-left transition-all min-h-[64px] ${
                plan === "annual"
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">$59.99</span>
                <span className="text-xs text-zinc-400">/yr</span>
              </div>
              <span className="block text-[10px] text-teal-400 font-medium mt-0.5">Save $36 · best value</span>
            </button>
            <button
              onClick={() => { tapHaptic("light"); setPlan("monthly"); }}
              className={`flex-1 px-3 py-3 rounded-xl border text-left transition-all min-h-[64px] ${
                plan === "monthly"
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">$7.99</span>
                <span className="text-xs text-zinc-400">/mo</span>
              </div>
              <span className="block text-[10px] text-zinc-500 mt-0.5">Billed monthly</span>
            </button>
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleStartTrial}
            disabled={purchasing}
            className="w-full px-4 py-4 min-h-[56px] bg-teal-500 hover:bg-teal-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-950 disabled:text-zinc-400 text-base font-bold rounded-2xl shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all"
          >
            {purchasing ? "Starting…" : `Start 7-day free trial · ${PRICING[plan].price}${PRICING[plan].period}`}
          </button>

          {restoreError && (
            <p className="mt-3 text-xs text-amber-400 leading-relaxed">{restoreError}</p>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
            <button
              onClick={handleRestore}
              className="text-zinc-400 hover:text-white transition-colors min-h-[44px] px-1"
            >
              Restore Purchases
            </button>
            <div className="flex gap-3">
              <a href="/terms" target="_blank" className="hover:text-white transition-colors">Terms</a>
              <a href="/privacy" target="_blank" className="hover:text-white transition-colors">Privacy</a>
            </div>
          </div>

          <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
            Auto-renews at {PRICING[plan].price}{PRICING[plan].period} after the trial. Cancel at least
            24 hours before the trial ends to avoid being charged. Manage in iOS Settings → Apple ID → Subscriptions.
          </p>
        </div>
      </div>
    </div>
  );
}
