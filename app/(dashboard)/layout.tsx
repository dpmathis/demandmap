"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { TenantProvider, useTenant } from "@/app/lib/context/TenantContext";
import { useMobile } from "@/app/lib/hooks/useMobile";
import { useNativeBridge } from "@/app/lib/hooks/useNativeBridge";
import { tapHaptic } from "@/app/lib/haptics";
import { type ReactNode } from "react";
import {
  LayoutDashboard, Map, Route, Calendar, Users, Settings, LogOut, TrendingUp, BarChart3, Download,
} from "lucide-react";
import { NotificationBell } from "@/app/components/NotificationBell";
import { BottomTabBar } from "@/app/components/BottomTabBar";
import { Paywall } from "@/app/components/Paywall";
import { SubscriptionProvider } from "@/app/lib/context/SubscriptionContext";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Explorer", icon: Map },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/planner", label: "Planner", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/export", label: "Export", icon: Download },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { user, tenant } = useTenant();
  const isMobile = useMobile();

  async function handleLogout() {
    tapHaptic("medium");
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="flex items-center justify-between px-3 px-safe pt-safe h-[calc(2.75rem+env(safe-area-inset-top))] bg-zinc-900/80 backdrop-blur border-b border-zinc-800 shrink-0 z-20">
      <div className="flex items-center gap-2 min-w-0">
        {!isMobile && (
          <span className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-base font-semibold tracking-tight text-zinc-100">DemandMap</span>
            <span className="font-mono text-[10px] text-zinc-500">NYC</span>
          </span>
        )}
        {!isMobile && (
          <div className="ml-3 flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => { tapHaptic("light"); router.push(item.href); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    active ? "bg-teal-500/15 text-teal-400" : "text-zinc-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {tenant && !isMobile && (
          <span className="text-[10px] text-zinc-600 hidden sm:block">{tenant.name}</span>
        )}
        {user && !isMobile && (
          <span className="text-[10px] text-zinc-500 hidden sm:block">{user.name || user.email}</span>
        )}
        <NotificationBell />
        <button
          onClick={handleLogout}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}

function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = pathname === "/map" || pathname === "/forecast";
  const isMobile = useMobile();
  useNativeBridge();

  if (isFullScreen) {
    return (
      <>
        {children}
        {isMobile && <BottomTabBar />}
      </>
    );
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <TopNav />
      <div className={`flex-1 min-h-0 overflow-auto ${isMobile ? "pb-[calc(72px+env(safe-area-inset-bottom))]" : ""}`}>
        {children}
      </div>
      {isMobile && <BottomTabBar />}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <SubscriptionProvider>
        <LayoutShell>{children}</LayoutShell>
        <Paywall />
      </SubscriptionProvider>
    </TenantProvider>
  );
}
