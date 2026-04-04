"use client";

import { useRef, useEffect, useState } from "react";

export default function TestMapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("1. Page rendered");

  useEffect(() => {
    if (!containerRef.current) {
      setStatus("ERROR: No container ref");
      return;
    }

    const el = containerRef.current;
    setStatus(`2. Container found: ${el.offsetWidth}x${el.offsetHeight}`);

    import("maplibre-gl/dist/maplibre-gl.css").catch(() => {});
    import("maplibre-gl").then((mod) => {
      const maplibregl = mod.default ?? mod;
      setStatus((prev) => prev + " → 3. maplibre-gl loaded");

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new (maplibregl as any).Map({
          container: el,
          style: "https://demotiles.maplibre.org/style.json",
          center: [-74.006, 40.7128],
          zoom: 10,
        });

        map.on("load", () => {
          setStatus((prev) => prev + " → 4. LOAD EVENT FIRED ✓");
        });
        map.on("error", (e: { error?: { message?: string } }) => {
          setStatus((prev) => prev + ` → ERROR: ${e.error?.message ?? JSON.stringify(e)}`);
        });
        map.on("idle", () => {
          setStatus((prev) =>
            prev.includes("IDLE") ? prev : prev + " → 5. IDLE (rendering complete) ✓"
          );
        });
      } catch (err) {
        setStatus(`INIT ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }).catch((err) => {
      setStatus(`IMPORT ERROR: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#111" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{
        position: "absolute", top: 10, left: 10, right: 10, zIndex: 9999,
        background: "white", color: "black", padding: "10px 14px",
        borderRadius: 6, fontSize: 13, fontFamily: "monospace", lineHeight: 1.6,
        wordBreak: "break-all",
      }}>
        {status}
      </div>
    </div>
  );
}
