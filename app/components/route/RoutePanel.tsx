"use client";

import { useState, useCallback } from "react";
import { X, Download, MapPin, Route, ChevronUp, ChevronDown } from "lucide-react";
import { BottomSheet } from "@/app/components/ui/BottomSheet";
import { StopCard, type RouteStopData } from "./StopCard";
import { AISuggestion, type SuggestionData } from "./AISuggestion";
import type { TimeWindow } from "@/app/lib/constants";

interface RoutePanelProps {
  routeId: string | null;
  routeName: string;
  stops: RouteStopData[];
  vertical: string;
  timeWindow: TimeWindow;
  isMobile?: boolean;
  onClose: () => void;
  onStopDelete: (stopId: string) => void;
  onSuggestionAccept: (suggestion: SuggestionData) => void;
  onRename: (name: string) => void;
}

export function RoutePanel({
  routeId,
  routeName,
  stops,
  vertical,
  timeWindow,
  isMobile,
  onClose,
  onStopDelete,
  onSuggestionAccept,
  onRename,
}: RoutePanelProps) {
  const [suggestion, setSuggestion] = useState<SuggestionData | null>(null);
  const [suggLoading, setSuggLoading] = useState(false);
  const [suggError, setSuggError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(routeName);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const fetchSuggestion = useCallback(async () => {
    if (!routeId) return;
    setSuggLoading(true);
    setSuggError(null);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/routes/${routeId}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeWindow }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuggestion(data.suggestion);
      if (isMobile) setSheetExpanded(true);
    } catch (err) {
      setSuggError(err instanceof Error ? err.message : "Failed to get suggestion");
    } finally {
      setSuggLoading(false);
    }
  }, [routeId, timeWindow, isMobile]);

  const handleAccept = useCallback((s: SuggestionData) => {
    onSuggestionAccept(s);
    setSuggestion(null);
  }, [onSuggestionAccept]);

  const handleExport = () => {
    if (!routeId) return;
    window.open(`/api/routes/${routeId}/export`, "_blank");
  };

  const commitRename = () => {
    if (nameValue.trim() && nameValue !== routeName) onRename(nameValue.trim());
    setEditingName(false);
  };

  const header = (
    <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
      {isMobile ? (
        <button
          onClick={() => setSheetExpanded(!sheetExpanded)}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        >
          <Route size={13} className="text-teal-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate">{routeName}</span>
          <span className="text-[10px] text-zinc-500 shrink-0">{stops.length} stops</span>
          {sheetExpanded ? <ChevronDown size={13} className="text-zinc-500 ml-auto shrink-0" /> : <ChevronUp size={13} className="text-zinc-500 ml-auto shrink-0" />}
        </button>
      ) : (
        <>
          <Route size={13} className="text-teal-400 shrink-0" />
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingName(false); }}
              className="flex-1 text-xs font-semibold bg-transparent text-white border-b border-zinc-600 focus:outline-none focus:border-teal-500"
            />
          ) : (
            <button
              onClick={() => { setNameValue(routeName); setEditingName(true); }}
              className="flex-1 text-xs font-semibold text-white text-left hover:text-teal-400 transition-colors truncate cursor-pointer"
            >
              {routeName}
            </button>
          )}
        </>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {routeId && (
          <button onClick={handleExport} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer" title="Export CSV">
            <Download size={13} />
          </button>
        )}
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
          <X size={13} />
        </button>
      </div>
    </div>
  );

  const body = (
    <>
      <div className={`overflow-y-auto p-3 ${isMobile ? "max-h-[50vh]" : "flex-1"}`}>
        {stops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <MapPin size={20} className="text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-500">Tap a block on the map<br />to add it to your route</p>
          </div>
        ) : (
          <div>
            {stops.map((stop, i) => (
              <StopCard key={stop.id} stop={stop} index={i} onDelete={onStopDelete} />
            ))}
          </div>
        )}
        {stops.length > 0 && (
          <AISuggestion
            suggestion={suggestion}
            loading={suggLoading}
            error={suggError}
            onFetch={fetchSuggestion}
            onAccept={handleAccept}
          />
        )}
      </div>
      {stops.length > 0 && (
        <div className="p-3 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600 text-center">
            {stops.length} stop{stops.length !== 1 ? "s" : ""} · auto-saved
          </p>
        </div>
      )}
    </>
  );

  // Mobile: swipeable bottom sheet
  if (isMobile) {
    return (
      <BottomSheet
        open={true}
        onClose={onClose}
        snapPoints={[25, 55, 90]}
        title={routeName}
      >
        {header}
        {body}
      </BottomSheet>
    );
  }

  // Desktop: right panel
  return (
    <div className="w-[280px] bg-zinc-900/60 backdrop-blur border-l border-zinc-800 flex flex-col shrink-0 h-full">
      {header}
      {body}
    </div>
  );
}
