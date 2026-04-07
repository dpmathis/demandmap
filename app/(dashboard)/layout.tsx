"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { TenantProvider, useTenant } from "@/app/lib/context/TenantContext";
import { useMobile } from "@/app/lib/hooks/useMobile";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Map, Route, Calendar, Users, Settings, LogOut, Menu, X, TrendingUp, BarChart3, Download,
} from "lucide-react";
import { NotificationBell } from "@/app/components/NotificationBell";

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

function NavContent() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { user, tenant } = useTenant();
  const isMobile = useMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Full-screen pages use their own layout
  const isFullScreen = pathname === "/map" || pathname === "/forecast";
  if (isFullScreen) return null;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navLinks = (
    <div className="flex items-center gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <button
            key={item.href}
            onClick={() => { router.push(item.href); setMobileOpen(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              active
                ? "bg-teal-500/15 text-teal-400"
                : "text-zinc-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon size={14} />
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <nav className="flex items-center justify-between px-3 h-11 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 shrink-0 z-20">
      <div className="flex items-center gap-2">
        {isMobile ? (
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 text-zinc-400 cursor-pointer">
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        ) : null}
        <span className="flex items-baseline gap-1.5">
          <span className="text-base font-semibold tracking-tight text-zinc-100">DemandMap</span>
          <span className="font-mono text-[10px] text-zinc-500">NYC</span>
        </span>
        {!isMobile && <div className="ml-3">{navLinks}</div>}
      </div>
      <div className="flex items-center gap-2">
        {tenant && (
          <span className="text-[10px] text-zinc-600 hidden sm:block">{tenant.name}</span>
        )}
        {user && (
          <span className="text-[10px] text-zinc-500 hidden sm:block">{user.name || user.email}</span>
        )}
        <NotificationBell />
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut size={13} />
        </button>
      </div>

      {/* Mobile nav dropdown */}
      {isMobile && mobileOpen && (
        <div className="absolute top-11 left-0 right-0 bg-zinc-900 border-b border-zinc-800 p-3 z-50 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setMobileOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer ${
                  active ? "bg-teal-500/15 text-teal-400" : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}

function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = pathname === "/map" || pathname === "/forecast";

  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <NavContent />
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <LayoutShell>{children}</LayoutShell>
    </TenantProvider>
  );
}
