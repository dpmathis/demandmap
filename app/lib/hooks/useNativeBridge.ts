"use client";

import { useEffect } from "react";

let bridgeStarted = false;

export function useNativeBridge() {
  useEffect(() => {
    if (bridgeStarted) return;
    bridgeStarted = true;

    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { App } = await import("@capacitor/app");
      const { PushNotifications } = await import("@capacitor/push-notifications");

      const platform = Capacitor.getPlatform();
      const appInfo = await App.getInfo().catch(() => null);
      const appVersion = appInfo?.version;
      const osVersion = navigator.userAgent;

      const perm = await PushNotifications.checkPermissions();
      if (perm.receive !== "granted") {
        const req = await PushNotifications.requestPermissions();
        if (req.receive !== "granted") return;
      }

      const registrationListener = await PushNotifications.addListener(
        "registration",
        async (info) => {
          if (cancelled) return;
          try {
            await fetch("/api/notifications/register-device", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform,
                token: info.value,
                appVersion,
                osVersion,
              }),
            });
          } catch {
            // ignore — the device will re-register on next launch
          }
        },
      );

      const errorListener = await PushNotifications.addListener(
        "registrationError",
        () => {
          // intentionally silent; common during simulator runs
        },
      );

      await PushNotifications.register();

      return () => {
        cancelled = true;
        registrationListener.remove();
        errorListener.remove();
      };
    })();
  }, []);
}
