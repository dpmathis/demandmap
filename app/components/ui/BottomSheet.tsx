"use client";

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  snapPoints?: number[]; // percentages of viewport height, e.g. [30, 60, 90]
  initialSnap?: number; // index into snapPoints
  title?: string;
}

export function BottomSheet({
  open,
  onClose,
  children,
  snapPoints = [35, 70, 92],
  initialSnap = 0,
  title,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, startHeight: 0, dragging: false });
  const [heightPct, setHeightPct] = useState(snapPoints[initialSnap]);
  const [transitioning, setTransitioning] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setHeightPct(snapPoints[initialSnap]);
    }
  }, [open, snapPoints, initialSnap]);

  const snapToNearest = useCallback(
    (pct: number, velocity: number) => {
      // If fast swipe down, close
      if (velocity > 1.5 && pct < snapPoints[0]) {
        onClose();
        return;
      }

      // Find nearest snap point
      let nearest = snapPoints[0];
      let minDist = Math.abs(pct - nearest);
      for (const sp of snapPoints) {
        const dist = Math.abs(pct - sp);
        if (dist < minDist) {
          minDist = dist;
          nearest = sp;
        }
      }

      // If below lowest snap with downward velocity, close
      if (pct < snapPoints[0] - 10) {
        onClose();
        return;
      }

      setTransitioning(true);
      setHeightPct(nearest);
      setTimeout(() => setTransitioning(false), 300);
    },
    [snapPoints, onClose]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = {
      startY: touch.clientY,
      startHeight: heightPct,
      dragging: true,
    };
  }, [heightPct]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.dragging) return;
    const touch = e.touches[0];
    const deltaY = dragRef.current.startY - touch.clientY;
    const deltaPct = (deltaY / window.innerHeight) * 100;
    const newPct = Math.max(10, Math.min(95, dragRef.current.startHeight + deltaPct));
    setHeightPct(newPct);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    const touch = e.changedTouches[0];
    const deltaY = dragRef.current.startY - touch.clientY;
    const velocity = Math.abs(deltaY) / 200; // rough velocity
    const direction = deltaY < 0 ? -1 : 1;
    snapToNearest(heightPct, direction < 0 ? velocity : 0);
  }, [heightPct, snapToNearest]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl flex flex-col ${
          transitioning ? "transition-all duration-300 ease-out" : ""
        }`}
        style={{ height: `${heightPct}vh` }}
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-8 h-1 rounded-full bg-zinc-700" />
          {title && (
            <p className="text-xs font-semibold text-zinc-300 mt-1.5">{title}</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {children}
        </div>
      </div>
    </>
  );
}
