import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useFakeRole } from "../lib/fakeAuth";
import NotificationBell from "./NotificationBell";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: "◉" },
  { to: "/governance/policies", label: "Policies", icon: "§" },
  { to: "/governance/audits", label: "Audits", icon: "✓" },
  { to: "/governance/compliance", label: "Compliance", icon: "⚠" },
  { to: "/reports", label: "Reports", icon: "▤" },
  { to: "/social/csr-activities", label: "CSR Activities", icon: "♻" },
  { to: "/gamification/challenges", label: "Challenges", icon: "🏆" },
  { to: "/gamification/leaderboard", label: "Leaderboard", icon: "📊" },
  { to: "/gamification/badges-rewards", label: "Badges & Rewards", icon: "🎖" },
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
