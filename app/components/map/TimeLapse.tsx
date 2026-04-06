"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, X, Loader2 } from "lucide-react";
import { TIME_WINDOWS, TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";
import type { MapActions } from "./MapCanvas";

interface TimeLapseProps {
  mapActions: MapActions | null;
  onClose: () => void;
  onTimeWindowChange?: (tw: TimeWindow) => void;
}

const SPEEDS = [
  { value: 2000, label: "0.5x" },
  { value: 1000, label: "1x" },
  { value: 500, label: "2x" },
] as const;

export function TimeLapse({ mapActions, onClose, onTimeWindowChange }: TimeLapseProps) {
  const [prefetching, setPrefetching] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1000);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const cacheRef = useRef<Map<string, unknown>>(new Map());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIdxRef = useRef(0);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  // Prefetch all 7 time windows for the current bbox
  useEffect(() => {
    if (!mapActions) return;
    const bbox = mapActions.getBbox();
    if (!bbox) return;

    let cancelled = false;
    setPrefetching(true);
    setReady(false);

    const params = new URLSearchParams({
      west: bbox.west.toString(),
      south: bbox.south.toString(),
      east: bbox.east.toString(),
      north: bbox.north.toString(),
    });

    Promise.all(
      TIME_WINDOWS.map((tw) => {
        const p = new URLSearchParams(params);
        p.set("timeWindow", tw);
        return fetch(`/api/map/blocks?${p}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => ({ tw, data }));
      })
    ).then((results) => {
      if (cancelled) return;
      for (const { tw, data } of results) {
        if (data) cacheRef.current.set(tw, data);
      }
      setPrefetching(false);
      setReady(true);
      // Show first frame
      const first = cacheRef.current.get(TIME_WINDOWS[0]);
      if (first) mapActions.setBlocksData(first);
    });

    return () => {
      cancelled = true;
    };
  }, [mapActions]);

  // Playback loop
  useEffect(() => {
    if (!playing || !ready || !mapActions) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    tickRef.current = setInterval(() => {
      const next = (currentIdxRef.current + 1) % TIME_WINDOWS.length;
      currentIdxRef.current = next;
      setCurrentIdx(next);
      const tw = TIME_WINDOWS[next];
      const data = cacheRef.current.get(tw);
      if (data) mapActions.setBlocksData(data);
      onTimeWindowChange?.(tw);
    }, speed);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [playing, ready, speed, mapActions, onTimeWindowChange]);

  function handleScrub(idx: number) {
    if (!mapActions) return;
    currentIdxRef.current = idx;
    setCurrentIdx(idx);
    const tw = TIME_WINDOWS[idx];
    const data = cacheRef.current.get(tw);
    if (data) mapActions.setBlocksData(data);
    onTimeWindowChange?.(tw);
  }

  const currentTw = TIME_WINDOWS[currentIdx];

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-zinc-900/95 border border-zinc-800 rounded-xl px-4 py-3 backdrop-blur shadow-2xl min-w-[520px]">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={!ready}
          className="flex items-center justify-center w-8 h-8 bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {prefetching ? (
            <Loader2 size={14} className="animate-spin" />
          ) : playing ? (
            <Pause size={14} />
          ) : (
            <Play size={14} />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Time lapse</span>
            <span className="text-xs font-mono text-teal-400 tabular-nums">{TIME_WINDOW_LABELS[currentTw]}</span>
          </div>
          <div className="flex gap-0.5">
            {TIME_WINDOWS.map((tw, i) => (
              <button
                key={tw}
                onClick={() => handleScrub(i)}
                disabled={!ready}
                className={`flex-1 h-1.5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  i === currentIdx ? "bg-teal-400" : i < currentIdx ? "bg-teal-700/50" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-0.5 bg-zinc-950 rounded-lg p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSpeed(s.value)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                speed === s.value ? "bg-teal-500/20 text-teal-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      {prefetching && (
        <div className="text-[9px] text-zinc-600 mt-1.5">Preloading all 7 time windows...</div>
      )}
    </div>
  );
}
