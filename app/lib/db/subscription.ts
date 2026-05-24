import { prisma } from "@/app/lib/db/prisma";

export type SubscriptionTier = "free" | "pro";

export type SubscriptionView = {
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  isInTrial: boolean;
  isActive: boolean;
};

const PAID_STATUSES = new Set(["active", "trialing", "in_grace_period"]);

export async function getSubscriptionView(tenantId: string): Promise<SubscriptionView> {
  const row = await prisma.subscription.findUnique({ where: { tenantId } });

  if (!row) {
    return {
      tier: "free",
      status: "none",
      currentPeriodEnd: null,
      trialEnd: null,
      isInTrial: false,
      isActive: false,
    };
  }

  const now = new Date();
  const periodValid = !row.currentPeriodEnd || row.currentPeriodEnd > now;
  const trialValid = row.trialEnd ? row.trialEnd > now : false;

  // Pro if status is paid AND we're still inside the current period
  const isActive = row.tier === "pro" && PAID_STATUSES.has(row.status) && periodValid;

  return {
    tier: isActive ? "pro" : "free",
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    trialEnd: row.trialEnd?.toISOString() ?? null,
    isInTrial: row.status === "trialing" && trialValid,
    isActive,
  };
}

export async function isPro(tenantId: string): Promise<boolean> {
  const view = await getSubscriptionView(tenantId);
  return view.isActive;
}

export class PaywallError extends Error {
  constructor() {
    super("Pro subscription required");
    this.name = "PaywallError";
  }
}

export async function requirePro(tenantId: string): Promise<void> {
  if (!(await isPro(tenantId))) {
    throw new PaywallError();
  }
}
