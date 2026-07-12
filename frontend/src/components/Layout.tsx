import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFakeRole } from "../lib/fakeAuth";

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

const navSections = [
  {
    section: null,
    items: [{ to: "/dashboard", label: "Dashboard", icon: "◉" }],
  },
  {
    section: "Environmental",
    items: [
      { to: "/env/emission-factors", label: "Emission Factors", icon: "🏭" },
      { to: "/env/carbon-transactions", label: "Carbon Transactions", icon: "💨" },
    ],
  },
  {
    section: "Governance",
    items: [
      { to: "/governance/policies", label: "Policies", icon: "§" },
      { to: "/governance/audits", label: "Audits", icon: "✓" },
      { to: "/governance/compliance", label: "Compliance", icon: "⚠" },
    ],
  },
  {
    section: "Social",
    items: [{ to: "/social/csr-activities", label: "CSR Activities", icon: "♻" }],
  },
  {
    section: "Gamification",
    items: [
      { to: "/gamification/challenges", label: "Challenges", icon: "🏆" },
      { to: "/gamification/leaderboard", label: "Leaderboard", icon: "📊" },
      { to: "/gamification/badges-rewards", label: "Badges & Rewards", icon: "🎖" },
    ],
  },
  {
    section: null,
    items: [{ to: "/reports", label: "Reports", icon: "▤" }],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [role, setRole] = useFakeRole();
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-emerald-950 text-emerald-50 flex flex-col">
        <div className="px-5 py-5 text-lg font-bold tracking-tight">
          🌿 EcoSphere
          <div className="text-[11px] font-normal text-emerald-300/80">ESG Management</div>
        </div>
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {navSections.map((group, i) => (
            <div key={i} className={group.section ? "pt-2" : ""}>
              {group.section && (
                <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/60">
                  {group.section}
                </div>
              )}
              {group.items.map((item) => (
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
            </div>
          ))}
        </nav>

        {/* ── Role switcher (testing only) ──────────────────────── */}
        <div className="px-4 py-2 border-t border-emerald-900">
          <label className="text-[10px] uppercase tracking-wider text-emerald-400/60 block mb-1">
            Test Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "employee")}
            className="w-full rounded bg-emerald-900 border border-emerald-800 text-emerald-100 text-xs px-2 py-1 focus:outline-none"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="px-5 py-4 text-xs text-emerald-300/70 border-t border-emerald-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <NotificationBell />
              {user ? (
                <span className="truncate">{user.name} · {user.role}</span>
              ) : (
                <span>Dev mode · {role}</span>
              )}
            </div>
            {user && (
              <button onClick={logout} className="underline hover:text-white shrink-0">Logout</button>
            )}
          </div>
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
