"use client";

import { useEffect } from "react";

/**
 * Reports Core Web Vitals (LCP, INP, TTFB, FCP, CLS) to /api/telemetry/vitals
 * once per session. Sampled at 100% for now — once we have a baseline, we can
 * drop sampling to ~10%.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { onLCP, onINP, onTTFB, onFCP, onCLS } = await import("web-vitals");

        const send = (metric: { name: string; value: number; id: string; rating?: string }) => {
          if (cancelled) return;
          const body = JSON.stringify({
            name: metric.name,
            value: metric.value,
            id: metric.id,
            rating: metric.rating,
            path: window.location.pathname,
            ua: navigator.userAgent.slice(0, 200),
            isNative: !!(window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform(),
          });

          // sendBeacon survives page unload, falls back to fetch keepalive
          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/telemetry/vitals", body);
          } else {
            fetch("/api/telemetry/vitals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              keepalive: true,
            }).catch(() => {});
          }
        };

        onLCP(send);
        onINP(send);
        onTTFB(send);
        onFCP(send);
        onCLS(send);
      } catch {
        // web-vitals unavailable or threw — no-op
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
