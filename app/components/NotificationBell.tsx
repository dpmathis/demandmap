"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, X, Check, CloudRain, Construction, TrendingUp, Info, Route } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  weather: CloudRain,
  closure: Construction,
  demand_spike: TrendingUp,
  route_reminder: Route,
  system: Info,
};

const TYPE_COLORS: Record<string, string> = {
  weather: "text-amber-400",
  closure: "text-red-400",
  demand_spike: "text-teal-400",
  route_reminder: "text-purple-400",
  system: "text-blue-400",
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? []);
        setUnreadCount(d.unreadCount ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications();
    // Poll every 5 minutes
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-teal-500 rounded-full text-[8px] font-bold flex items-center justify-center text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
            <span className="text-xs font-semibold">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-teal-400 hover:text-teal-300 cursor-pointer flex items-center gap-0.5"
                >
                  <Check size={10} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-0.5 text-zinc-600 hover:text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={20} className="mx-auto text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-600">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Info;
                const color = TYPE_COLORS[n.type] ?? "text-zinc-400";
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`w-full px-3 py-2.5 text-left flex gap-2 hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                      n.read ? "opacity-50" : ""
                    }`}
                  >
                    <Icon size={14} className={`${color} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate">{n.title}</p>
                      <p className="text-[10px] text-zinc-500 line-clamp-2">{n.body}</p>
                      <p className="text-[9px] text-zinc-600 mt-0.5">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
