import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./ToastProvider";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const { showToast } = useToast();

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get<{ count: number }>("/notifications/unread-count");
      setCount(data.count);
    } catch {
      /* silent — bell shouldn't crash the app */
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 15_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) {
      try {
        const { data } = await api.get<Notification[]>("/notifications", {
          params: { unread_only: false },
        });
        setItems(data.slice(0, 20));
      } catch {
        /* silent */
      }
    }
  }

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all");
      setCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast("All notifications marked as read", "green");
    } catch {
      showToast("Failed to mark notifications as read", "red");
    }
  }

  async function markOneRead(id: number) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setCount((c) => Math.max(0, c - 1));
      showToast("Notification marked as read", "green");
    } catch {
      showToast("Failed to mark notification as read", "red");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-md text-emerald-200 hover:bg-emerald-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-lg bg-white shadow-xl border border-stone-200">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
              <span className="text-sm font-semibold text-stone-800">Notifications</span>
              {count > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-400">No notifications yet</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => !n.is_read && markOneRead(n.id)}
                    className={`px-4 py-3 border-b border-stone-50 cursor-pointer hover:bg-stone-50 transition-colors ${
                      !n.is_read ? "bg-emerald-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-800 truncate">{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-stone-400 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
