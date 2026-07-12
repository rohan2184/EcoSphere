import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import NotificationBell from "./NotificationBell";

type NavItem = { to: string; label: string; icon: string; roles?: string[] };

const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "◉" },
  { to: "/governance/policies", label: "Policies", icon: "§" },
  { to: "/governance/audits", label: "Audits", icon: "✓" },
  { to: "/governance/compliance", label: "Compliance", icon: "⚠" },
  { to: "/reports", label: "Reports", icon: "▤" },
  { to: "/social/csr-activities", label: "CSR Activities", icon: "♻" },
  { to: "/social/diversity", label: "Social Insights", icon: "👥" },
  { to: "/social/diversity-metrics", label: "Diversity Metrics", icon: "📈", roles: ["admin"] },
  { to: "/gamification/challenges", label: "Challenges", icon: "🏆" },
  { to: "/gamification/leaderboard", label: "Leaderboard", icon: "📊" },
  { to: "/gamification/badges-rewards", label: "Badges & Rewards", icon: "🎖" },
  // Env module — master/env writes are admin/manager only (plan §8)
  { to: "/env/dashboard", label: "Emissions", icon: "🌍" },
  { to: "/env/emission-factors", label: "Emission Factors", icon: "🏭", roles: ["admin", "manager"] },
  { to: "/env/carbon-transactions", label: "Carbon Transactions", icon: "💨", roles: ["admin", "manager"] },
  { to: "/env/goals", label: "Env Goals", icon: "🎯", roles: ["admin", "manager"] },
  { to: "/env/products", label: "Product Profiles", icon: "📦", roles: ["admin", "manager"] },
  // Settings — admin/manager only
  { to: "/settings", label: "Settings", icon: "⚙", roles: ["admin", "manager"] },
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
          {nav
            .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
            .map((item) => (
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <NotificationBell />
              {user && <span className="truncate">{user.name} · {user.role}</span>}
            </div>
            <button onClick={logout} className="underline hover:text-white shrink-0">Logout</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
