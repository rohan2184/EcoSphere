import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  function refreshCount() {
    api.get<{ count: number }>("/notifications/unread-count").then((r) => setCount(r.data.count)).catch(() => {});
  }

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 30_000); // ponytail: 30s poll; websockets if it ever matters
    return () => clearInterval(t);
  }, []);

  async function toggle() {
    if (!open) {
      const { data } = await api.get<Notification[]>("/notifications").catch(() => ({ data: [] as Notification[] }));
      setItems(data);
    }
    setOpen(!open);
  }

  async function markRead(id: number) {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    refreshCount();
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all").catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    refreshCount();
  }

  return (
    <div className="relative">
      <button onClick={toggle} className="relative rounded-full p-2 text-stone-500 hover:bg-stone-100" title="Notifications">
        <span className="text-lg">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-stone-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
              <span className="text-sm font-semibold text-stone-700">Notifications</span>
              {items.some((n) => !n.is_read) && (
                <button onClick={markAllRead} className="text-xs text-emerald-700 underline">Mark all read</button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone-400">No notifications</li>}
              {items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`cursor-pointer border-b border-stone-50 px-4 py-2.5 text-sm hover:bg-stone-50 ${n.is_read ? "text-stone-400" : "text-stone-700"}`}
                >
                  <div className={n.is_read ? "" : "font-medium"}>{n.title}</div>
                  {n.message && <div className="mt-0.5 line-clamp-2 text-xs">{n.message}</div>}
                  <div className="mt-0.5 text-[11px] text-stone-400">{new Date(n.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: "◉" },
  { to: "/governance/policies", label: "Policies", icon: "§" },
  { to: "/governance/audits", label: "Audits", icon: "✓" },
  { to: "/governance/compliance", label: "Compliance", icon: "⚠" },
  { to: "/reports", label: "Reports", icon: "▤" },
  // Person A/B: append your module pages here (env, social, gamification)
];

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-emerald-950 text-emerald-50 flex flex-col">
        <div className="px-5 py-5 text-lg font-bold tracking-tight">
          🌿 EcoSphere
          <div className="text-[11px] font-normal text-emerald-300/80">ESG Management</div>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-emerald-800 font-medium" : "text-emerald-200/90 hover:bg-emerald-900"
                }`
              }
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-emerald-300/70 border-t border-emerald-900">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{user.name} · {user.role}</span>
              <button onClick={logout} className="underline hover:text-white">Logout</button>
            </div>
          ) : (
            <span>Not signed in (dev)</span>
          )}
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="flex items-center justify-end gap-3 border-b border-stone-200 bg-white px-6 py-2">
          {user && <span className="text-sm text-stone-500">{user.name}</span>}
          <NotificationBell />
        </header>
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
