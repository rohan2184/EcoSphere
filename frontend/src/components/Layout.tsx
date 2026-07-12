import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import NotificationBell from "./NotificationBell";

type NavItem = { to: string; label: string; icon: string; roles?: string[] };

const nav: NavItem[] = [
  { to: "/dashboard",      label: "Dashboard",      icon: "◉" },
  { to: "/environmental",  label: "Environmental",  icon: "🌍" },
  { to: "/social",         label: "Social",         icon: "👥" },
  { to: "/governance",     label: "Governance",     icon: "🏛" },
  { to: "/gamification",   label: "Gamification",   icon: "🏆" },
  { to: "/reports",        label: "Reports",        icon: "▤" },
  { to: "/settings",       label: "Settings",       icon: "⚙", roles: ["admin", "manager"] },
];

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On desktop the sidebar is always visible (no toggle needed)
  const showSidebar = !isMobile || sidebarOpen;

  const closeSidebar = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="sidebar-hamburger"
          aria-label="Open navigation"
        >
          ☰
        </button>
      )}

      {/* Backdrop (mobile only) */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      {showSidebar && (
        <aside
          className={`w-56 shrink-0 bg-emerald-950 text-emerald-50 flex flex-col ${
            isMobile ? "sidebar-mobile" : ""
          }`}
        >
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
                onClick={closeSidebar}
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
      )}

      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
