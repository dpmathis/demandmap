"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Map as MapIcon,
  Route as RouteIcon,
  Calendar,
  TrendingUp,
  MoreHorizontal,
  X,
  LayoutDashboard,
  BarChart3,
  Download,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import { tapHaptic } from "@/app/lib/haptics";
import { createClient } from "@/app/lib/supabase/client";

type TabItem = {
  href: string;
  label: string;
  icon: typeof MapIcon;
  match: (pathname: string) => boolean;
};

const TABS: TabItem[] = [
  { href: "/map", label: "Map", icon: MapIcon, match: (p) => p.startsWith("/map") },
  { href: "/routes", label: "Routes", icon: RouteIcon, match: (p) => p.startsWith("/routes") },
  { href: "/planner", label: "Planner", icon: Calendar, match: (p) => p.startsWith("/planner") },
  { href: "/forecast", label: "Forecast", icon: TrendingUp, match: (p) => p.startsWith("/forecast") },
];

const MORE_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/export", label: "Export", icon: Download },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [moreOpen, setMoreOpen] = useState(false);

  // Expose tab-bar height to floating UI on full-screen pages.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--bottom-tab-h",
      "calc(3.5rem + env(safe-area-inset-bottom))",
    );
    return () => {
      document.documentElement.style.setProperty("--bottom-tab-h", "0px");
    };
  }, []);

  const moreActive = MORE_ITEMS.some(
    (item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)),
  );

  function go(href: string) {
    tapHaptic("light");
    setMoreOpen(false);
    router.push(href);
  }

  async function handleLogout() {
    tapHaptic("medium");
    setMoreOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl shadow-2xl px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            role="dialog"
          >
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-zinc-200">More</span>
              <button
                onClick={() => { tapHaptic("light"); setMoreOpen(false); }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-1 mt-2">
              {MORE_ITEMS.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => go(item.href)}
                    className={`flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl text-base text-left transition-colors ${
                      active
                        ? "bg-teal-500/15 text-teal-400"
                        : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </button>
                );
              })}
              <div className="my-2 border-t border-zinc-800" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl text-base text-left text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <LogOut size={20} />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="flex items-stretch">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <button
                key={tab.href}
                onClick={() => go(tab.href)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
                  active ? "text-teal-400" : "text-zinc-500 hover:text-zinc-200"
                }`}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => { tapHaptic("light"); setMoreOpen((v) => !v); }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
              moreActive || moreOpen ? "text-teal-400" : "text-zinc-500 hover:text-zinc-200"
            }`}
            aria-label="More"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={22} strokeWidth={moreActive || moreOpen ? 2.25 : 1.75} />
            <span className="text-[10px] font-medium tracking-wide">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
