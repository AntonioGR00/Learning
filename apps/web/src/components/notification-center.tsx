"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getSession } from "@/lib/api";

type NotificationItem = {
  id: number;
  type: "ASSIGNMENT_CREATED" | "ANNOUNCEMENT_CREATED" | "GRADE_PUBLISHED";
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationCenter() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await apiFetch<NotificationItem[]>("/notifications");
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  async function handleMarkAllRead() {
    await apiFetch<{ updated: number }>("/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
  }

  async function handleOpenNotification(notification: NotificationItem) {
    const session = getSession();
    if (!notification.readAt) {
      await apiFetch<NotificationItem>(`/notifications/${notification.id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    }

    setOpen(false);
    if (session?.user.role === "FAMILY") {
      router.push("/dashboard");
    } else if (notification.link) {
      router.push(notification.link);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-2 text-sm font-medium text-[#15231d] transition hover:bg-[#f1e7db]"
      >
        Notificaciones
        {unreadCount > 0 && (
          <span className="ml-2 rounded-full bg-[#c4643b] px-2 py-0.5 text-[11px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#15231d]">Centro de notificaciones</p>
              <p className="text-xs text-[#8c6d57]">Avisos recientes de tu actividad</p>
            </div>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-[#8c6d57] transition hover:text-[#c4643b] disabled:opacity-40"
            >
              Marcar todo
            </button>
          </div>

          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-[#55635d]">Cargando...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-[#8c6d57]">No tienes notificaciones todavía.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleOpenNotification(notification)}
                  className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                    notification.readAt
                      ? "border-[rgba(21,35,29,0.08)] bg-[#fcfaf7]"
                      : "border-[rgba(196,100,59,0.2)] bg-[#fff7ec]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[#15231d]">{notification.title}</p>
                    {!notification.readAt && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#c4643b]" />}
                  </div>
                  <p className="mt-1 text-xs text-[#55635d] line-clamp-2">{notification.body}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-widest text-[#8c6d57]">
                    {new Date(notification.createdAt).toLocaleDateString("es", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}