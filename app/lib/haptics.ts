"use client";

import { Capacitor } from "@capacitor/core";

export type HapticStyle = "light" | "medium" | "heavy";

export async function tapHaptic(style: HapticStyle = "light") {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] });
  } catch {
    // Plugin not available on this platform — no-op.
  }
}

export async function selectionHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionStart();
    await Haptics.selectionEnd();
  } catch {
    // no-op
  }
}

export async function notificationHaptic(type: "success" | "warning" | "error" = "success") {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    const map = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: map[type] });
  } catch {
    // no-op
  }
}
