// Shared seam — append routes for your module, don't rewrite (plan §10).
import { Navigate, Route, Routes } from "react-router-dom";
import { AUTH_ENFORCED, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/dashboard/Dashboard";
import Reports from "./pages/reports/Reports";
import Settings from "./pages/settings/Settings";

// Module tab pages (C1)
import Environmental from "./pages/env/Environmental";
import Social from "./pages/social/Social";
import Governance from "./pages/governance/Governance";
import GamificationPage from "./pages/gamification/Gamification";

function Protected({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (AUTH_ENFORCED && !token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/* Redirect helper: /old/path → /module?tab=key */
function TabRedirect({ to, tab }: { to: string; tab: string }) {
  return <Navigate to={`/${to}?tab=${tab}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />

        {/* ── Module pages (C1 — tabbed) ────────────────────── */}
        <Route path="environmental" element={<Environmental />} />
        <Route path="social" element={<Social />} />
        <Route path="governance" element={<Governance />} />
        <Route path="gamification" element={<GamificationPage />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />

        {/* ── Backward-compatibility redirects ──────────────── */}
        {/* Env sub-routes → /environmental?tab=... */}
        <Route path="env" element={<TabRedirect to="environmental" tab="emissions" />} />
        <Route path="env/dashboard" element={<TabRedirect to="environmental" tab="emissions" />} />
        <Route path="env/emission-factors" element={<TabRedirect to="environmental" tab="emission-factors" />} />
        <Route path="env/carbon-transactions" element={<TabRedirect to="environmental" tab="carbon-transactions" />} />
        <Route path="env/goals" element={<TabRedirect to="environmental" tab="goals" />} />
        <Route path="env/products" element={<TabRedirect to="environmental" tab="product-profiles" />} />
        <Route path="env/operations" element={<TabRedirect to="environmental" tab="operations" />} />

        {/* Social sub-routes → /social?tab=... */}
        <Route path="social/csr-activities" element={<TabRedirect to="social" tab="csr-activities" />} />
        <Route path="social/diversity" element={<TabRedirect to="social" tab="diversity" />} />
        <Route path="social/diversity-metrics" element={<TabRedirect to="social" tab="diversity" />} />

        {/* Governance sub-routes → /governance?tab=... */}
        <Route path="governance/policies" element={<TabRedirect to="governance" tab="policies" />} />
        <Route path="governance/audits" element={<TabRedirect to="governance" tab="audits" />} />
        <Route path="governance/compliance" element={<TabRedirect to="governance" tab="compliance" />} />

        {/* Gamification sub-routes → /gamification?tab=... */}
        <Route path="gamification/challenges" element={<TabRedirect to="gamification" tab="challenges" />} />
        <Route path="gamification/leaderboard" element={<TabRedirect to="gamification" tab="leaderboard" />} />
        <Route path="gamification/badges-rewards" element={<TabRedirect to="gamification" tab="badges-rewards" />} />
      </Route>
    </Routes>
  );
}
