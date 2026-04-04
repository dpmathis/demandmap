"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { Map, Route, Users, LogOut } from "lucide-react";

export default function MapPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-dvh bg-[#0a0f1e] text-white flex flex-col">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-4 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-6">
          <span className="text-lg font-black tracking-tight">DemandMap</span>
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white">
              <Map size={14} /> Explorer
            </button>
            <button
              onClick={() => router.push("/routes")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5"
            >
              <Route size={14} /> Routes
            </button>
            <button
              onClick={() => router.push("/team")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5"
            >
              <Users size={14} /> Team
            </button>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
        >
          <LogOut size={14} /> Sign out
        </button>
      </nav>

      {/* Map area — placeholder until MapLibre is wired */}
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <Map size={48} className="mx-auto mb-4 text-teal-500" />
          <h2 className="text-xl font-bold mb-2">Map Explorer</h2>
          <p className="text-sm text-zinc-500 max-w-xs">
            The demand map will render here with MapLibre GL, demand choropleth,
            vertical selector, and live overlays.
          </p>
        </div>
      </div>
    </div>
  );
}
