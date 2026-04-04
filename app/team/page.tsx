"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Route, Users, LogOut, UserPlus, Trash2, Crown, User } from "lucide-react";
import { createClient } from "@/app/lib/supabase/client";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  routeCount: number;
}

export default function TeamPage() {
  const router = useRouter();
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members ?? []);
        setTenantName(d.tenantName ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg(null);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteMsg({ type: "ok", text: `Invite sent to ${inviteEmail}` });
      setInviteEmail("");
    } else {
      setInviteMsg({ type: "err", text: data.error ?? "Failed to send invite" });
    }
    setInviting(false);
  }

  async function handleRemove(id: string) {
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <nav className="flex items-center justify-between px-4 h-11 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 shrink-0 z-20">
        <div className="flex items-center gap-5">
          <span className="text-base font-black tracking-tight">DemandMap</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => router.push("/map")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <Map size={13} /> Explorer
            </button>
            <button onClick={() => router.push("/routes")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <Route size={13} /> Routes
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-500/15 text-teal-400">
              <Users size={13} /> Team
            </button>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
          <LogOut size={13} />
        </button>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold">Team</h1>
            {tenantName && <p className="text-sm text-zinc-500 mt-0.5">{tenantName}</p>}
          </div>

          {/* Invite form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <UserPlus size={13} className="text-teal-400" /> Invite teammate
            </h2>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={inviting || !inviteEmail}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {inviting ? "Sending..." : "Send invite"}
              </button>
            </form>
            {inviteMsg && (
              <p className={`text-xs mt-2 ${inviteMsg.type === "ok" ? "text-teal-400" : "text-red-400"}`}>
                {inviteMsg.text}
              </p>
            )}
          </div>

          {/* Members list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    {m.role === "admin"
                      ? <Crown size={14} className="text-amber-400" />
                      : <User size={14} className="text-zinc-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                    {m.name && <p className="text-[10px] text-zinc-500 truncate">{m.email}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        m.role === "admin" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-500"
                      }`}>{m.role}</span>
                      {m.routeCount > 0 && (
                        <span className="text-[9px] text-zinc-600">
                          {m.routeCount} route{m.routeCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {m.role !== "admin" && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors cursor-pointer p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
