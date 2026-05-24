"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { fetchInitialMe, invalidateInitialMe } from "@/app/lib/data/initial";

export type SubscriptionView = {
  tier: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  isInTrial: boolean;
  isActive: boolean;
};

type SubscriptionContextValue = {
  subscription: SubscriptionView | null;
  loading: boolean;
  refresh: () => Promise<void>;
  showPaywall: (feature?: string) => void;
  paywallOpen: boolean;
  paywallFeature: string | null;
  hidePaywall: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // refresh() is called after a purchase — bypass the initial-load cache
    // and hit the dedicated subscription endpoint
    invalidateInitialMe();
    try {
      const res = await fetch("/api/me/subscription", { cache: "no-store" });
      if (!res.ok) {
        setSubscription({
          tier: "free",
          status: "none",
          currentPeriodEnd: null,
          trialEnd: null,
          isInTrial: false,
          isActive: false,
        });
        return;
      }
      const data = await res.json();
      setSubscription(data.subscription);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial mount: read from the shared /api/me payload so we don't fire a
  // second round-trip alongside TenantProvider
  useEffect(() => {
    let cancelled = false;
    fetchInitialMe()
      .then((data) => {
        if (cancelled) return;
        setSubscription(data.subscription);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showPaywall = useCallback((feature?: string) => {
    setPaywallFeature(feature ?? null);
    setPaywallOpen(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setPaywallOpen(false);
    setPaywallFeature(null);
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{ subscription, loading, refresh, showPaywall, paywallOpen, paywallFeature, hidePaywall }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used inside <SubscriptionProvider>");
  return ctx;
}

/** Returns true when the current user has an active Pro subscription. */
export function useIsPro() {
  const { subscription } = useSubscription();
  return subscription?.isActive ?? false;
}

/**
 * Wraps an action that requires Pro. If the user is Pro, runs the action.
 * Otherwise, shows the paywall.
 */
export function useProGate() {
  const { subscription, showPaywall } = useSubscription();

  return useCallback(
    (feature: string, action: () => void) => {
      if (subscription?.isActive) {
        action();
      } else {
        showPaywall(feature);
      }
    },
    [subscription, showPaywall],
  );
}
