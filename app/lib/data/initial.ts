"use client";

/**
 * Shared initial-load fetcher for /api/me. Deduplicates the in-flight request
 * across multiple providers (TenantProvider + SubscriptionProvider both mount
 * on the same render and would otherwise each fire their own round-trip).
 *
 * After the initial mount, individual contexts can do their own refresh
 * fetches (e.g. SubscriptionProvider after a purchase) without going
 * through this cache.
 */

type MePayload = {
  user: { id: string; authId: string; email: string; name: string; role: string } | null;
  tenant: { id: string; name: string; slug: string; defaultVertical: string } | null;
  subscription: {
    tier: "free" | "pro";
    status: string;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
    isInTrial: boolean;
    isActive: boolean;
  };
  status: number;
};

let inflight: Promise<MePayload> | null = null;

const EMPTY_PAYLOAD: MePayload = {
  user: null,
  tenant: null,
  subscription: {
    tier: "free",
    status: "none",
    currentPeriodEnd: null,
    trialEnd: null,
    isInTrial: false,
    isActive: false,
  },
  status: 0,
};

export function fetchInitialMe(): Promise<MePayload> {
  if (inflight) return inflight;

  inflight = fetch("/api/me")
    .then(async (r) => {
      if (!r.ok) return { ...EMPTY_PAYLOAD, status: r.status };
      const data = await r.json();
      return {
        user: data.user ?? null,
        tenant: data.tenant ?? null,
        subscription: data.subscription ?? EMPTY_PAYLOAD.subscription,
        status: r.status,
      };
    })
    .catch(() => ({ ...EMPTY_PAYLOAD, status: 0 }));

  return inflight;
}

/** Forces the next call to fetchInitialMe() to re-hit the network. */
export function invalidateInitialMe() {
  inflight = null;
}
