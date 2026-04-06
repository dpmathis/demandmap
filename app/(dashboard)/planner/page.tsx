"use client";

import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Sparkles, Copy, Trash2, LayoutGrid, Users, X } from "lucide-react";
import { WeekNav } from "@/app/components/planner/WeekNav";
import { PlannerGrid } from "@/app/components/planner/PlannerGrid";
import { RouteDrawer, type AvailableRoute } from "@/app/components/planner/RouteDrawer";
import { TeamSwimlane } from "@/app/components/planner/TeamSwimlane";
import type { SlotData } from "@/app/components/planner/SlotCard";

interface WeeklyPlan {
  id: string;
  name: string;
  weekStart: string;
  status: string;
  slots?: SlotData[];
}

function mondayOfWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function PlannerPage() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [routes, setRoutes] = useState<AvailableRoute[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "team">("calendar");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;

  const loadSlots = useCallback(async (planId: string) => {
    const res = await fetch(`/api/planner/${planId}/slots`);
    const data = await res.json();
    setSlots(data.slots ?? []);
  }, []);

  // Initial load
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [plansRes, routesRes] = await Promise.all([
        fetch("/api/planner").then((r) => r.json()),
        fetch("/api/routes").then((r) => r.json()),
      ]);
      const loadedPlans: WeeklyPlan[] = plansRes.plans ?? [];
      const loadedRoutes = (routesRes.routes ?? []).map((r: { id: string; name: string; vertical: string; stops?: unknown[] }) => ({
        id: r.id,
        name: r.name,
        vertical: r.vertical,
        stopCount: r.stops?.length ?? 0,
      }));
      setPlans(loadedPlans);
      setRoutes(loadedRoutes);
      setLoading(false);
    }
    load();
  }, []);

  // Auto-select plan matching current weekStart
  useEffect(() => {
    if (plans.length === 0) {
      setActivePlanId(null);
      setSlots([]);
      return;
    }
    const iso = weekStart.toISOString().slice(0, 10);
    const match = plans.find((p) => p.weekStart.slice(0, 10) === iso);
    if (match) {
      setActivePlanId(match.id);
      loadSlots(match.id);
    } else {
      setActivePlanId(null);
      setSlots([]);
    }
  }, [plans, weekStart, loadSlots]);

  async function createPlan() {
    const res = await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: weekStart.toISOString() }),
    });
    if (!res.ok) return;
    const { plan } = await res.json();
    setPlans((prev) => [plan, ...prev]);
    setActivePlanId(plan.id);
    setSlots([]);
  }

  async function deletePlan() {
    if (!activePlanId) return;
    if (!confirm("Delete this week's plan?")) return;
    await fetch(`/api/planner/${activePlanId}`, { method: "DELETE" });
    setPlans((prev) => prev.filter((p) => p.id !== activePlanId));
    setActivePlanId(null);
    setSlots([]);
  }

  async function clonePlan() {
    if (!activePlanId) return;
    const res = await fetch(`/api/planner/${activePlanId}/clone`, { method: "POST" });
    if (!res.ok) return;
    const { plan } = await res.json();
    setPlans((prev) => [plan, ...prev]);
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(weekStart.getDate() + 7);
    setWeekStart(nextWeek);
  }

  async function suggest() {
    if (!activePlanId) return;
    setSuggesting(true);
    setSuggestionNote(null);
    try {
      const res = await fetch(`/api/planner/${activePlanId}/suggest`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSuggestionNote(data.error ?? "Suggestion failed");
        return;
      }
      const { suggestions, rationale } = data as {
        suggestions: Array<{ routeId: string; dayOfWeek: number; timeWindow: string }>;
        rationale: string;
      };
      setSuggestionNote(rationale);
      // Add suggested slots (POST each)
      const created: SlotData[] = [];
      for (const s of suggestions) {
        const r = await fetch(`/api/planner/${activePlanId}/slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s),
        });
        if (r.ok) {
          const { slot } = await r.json();
          created.push(slot);
        }
      }
      setSlots((prev) => [...prev, ...created]);
    } catch (e) {
      setSuggestionNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!activePlanId) return;
    const { active, over } = event;
    if (!over) return;
    const overData = over.data.current as { dayOfWeek: number; timeWindow: string } | undefined;
    if (!overData) return;
    const activeData = active.data.current as
      | { type: "route"; routeId: string; name: string; vertical: string }
      | { type: "slot"; slot: SlotData }
      | undefined;
    if (!activeData) return;

    if (activeData.type === "route") {
      const body = { routeId: activeData.routeId, dayOfWeek: overData.dayOfWeek, timeWindow: overData.timeWindow };
      const res = await fetch(`/api/planner/${activePlanId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { slot } = await res.json();
        setSlots((prev) => [...prev, slot]);
      }
    } else if (activeData.type === "slot") {
      const slot = activeData.slot;
      if (slot.dayOfWeek === overData.dayOfWeek && slot.timeWindow === overData.timeWindow) return;
      const res = await fetch(`/api/planner/${activePlanId}/slots/${slot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: overData.dayOfWeek, timeWindow: overData.timeWindow }),
      });
      if (res.ok) {
        const { slot: updated } = await res.json();
        setSlots((prev) => prev.map((s) => (s.id === slot.id ? updated : s)));
      }
    }
  }

  async function removeSlot(slotId: string) {
    if (!activePlanId) return;
    await fetch(`/api/planner/${activePlanId}/slots/${slotId}`, { method: "DELETE" });
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800/80 bg-zinc-950 shrink-0">
          {/* Left: status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-teal-500">
              <LayoutGrid size={14} strokeWidth={2.5} />
              <span className="font-mono font-bold text-sm tracking-wider uppercase">
                Planner
              </span>
            </div>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="font-mono text-[10px] text-zinc-500 uppercase flex items-center gap-2 tracking-wider">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  activePlan ? "bg-teal-500 pulse-op" : "bg-zinc-600"
                }`}
              />
              {activePlan ? `PLAN_ACTIVE // ${slots.length} SLOTS` : "NO_ACTIVE_PLAN"}
            </div>
          </div>

          {/* Center: week nav */}
          <WeekNav weekStart={weekStart} onChange={setWeekStart} />

          {/* Right: view toggle + actions */}
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
              <button
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  view === "calendar"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <LayoutGrid size={11} /> GRID
              </button>
              <button
                onClick={() => setView("team")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  view === "team"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Users size={11} /> TEAM
              </button>
            </div>
            {activePlan ? (
              <>
                <button
                  onClick={suggest}
                  disabled={suggesting}
                  className="relative group overflow-hidden px-3 py-1.5 bg-zinc-900 border border-violet-500/30 rounded-md flex items-center gap-2 hover:border-violet-500 hover:bg-violet-500/10 transition-all duration-300 disabled:opacity-50 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/10 to-violet-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Sparkles size={12} className="text-violet-400 relative z-10" />
                  <span className="font-mono text-[11px] font-bold text-violet-300 tracking-wide relative z-10">
                    {suggesting ? "THINKING..." : "SUGGEST WEEK [AI]"}
                  </span>
                </button>
                <button
                  onClick={clonePlan}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] font-mono font-medium rounded-md transition-colors cursor-pointer"
                  title="Clone to next week"
                >
                  <Copy size={12} /> CLONE
                </button>
                <button
                  onClick={deletePlan}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors cursor-pointer"
                  title="Delete plan"
                >
                  <Trash2 size={13} />
                </button>
              </>
            ) : (
              <button
                onClick={createPlan}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-mono font-bold tracking-wide rounded-md transition-colors cursor-pointer"
              >
                <Plus size={13} /> CREATE PLAN
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex">
          <RouteDrawer routes={routes} />
          <div className="flex-1 overflow-auto p-4">
            {activePlan ? (
              view === "calendar" ? (
                <PlannerGrid slots={slots} weekStart={weekStart} onRemoveSlot={removeSlot} />
              ) : (
                <TeamSwimlane slots={slots} />
              )
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="text-zinc-500 text-sm mb-2">No plan for this week</div>
                  <div className="text-zinc-600 text-xs mb-4">
                    Create a plan to schedule routes across time windows.
                  </div>
                  <button
                    onClick={createPlan}
                    className="flex items-center gap-1.5 mx-auto px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={13} /> Create plan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI suggestion HUD */}
        {suggestionNote && (
          <div className="fixed bottom-4 right-4 z-40 w-[320px] bg-zinc-900/95 backdrop-blur border border-violet-500/40 rounded-md shadow-2xl shadow-violet-500/10 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-violet-500/20 bg-violet-500/5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-violet-400" />
                <span className="font-mono text-[10px] font-bold text-violet-300 tracking-widest uppercase">
                  AI Rationale
                </span>
              </div>
              <button
                onClick={() => setSuggestionNote(null)}
                className="p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </div>
            <div className="px-3 py-2.5 text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {suggestionNote}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
