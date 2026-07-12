// Shared seam — append routes for your module, don't rewrite (plan §10).
import { Navigate, Route, Routes } from "react-router-dom";
import { AUTH_ENFORCED, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/dashboard/Dashboard";
import Policies from "./pages/governance/Policies";
import Audits from "./pages/governance/Audits";
import ComplianceIssues from "./pages/governance/ComplianceIssues";
import Reports from "./pages/reports/Reports";
import EmissionFactors from "./pages/env/EmissionFactors";
import CarbonTransactions from "./pages/env/CarbonTransactions";
import CSRActivityList from "./pages/social/CSRActivityList";
import ChallengeList from "./pages/gamification/ChallengeList";
import Leaderboard from "./pages/gamification/Leaderboard";
import BadgesAndRewards from "./pages/gamification/BadgesAndRewards";
import EmissionsDashboard from "./pages/env/EmissionsDashboard";
import Goals from "./pages/env/Goals";
import Settings from "./pages/settings/Settings";
import ProductProfiles from "./pages/env/ProductProfiles";
import DiversityDashboard from "./pages/social/DiversityDashboard";

function Protected({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (AUTH_ENFORCED && !token) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
        <Route path="governance/policies" element={<Policies />} />
        <Route path="governance/audits" element={<Audits />} />
        <Route path="governance/compliance" element={<ComplianceIssues />} />
        <Route path="reports" element={<Reports />} />
        {/* Person A: env module routes here */}
        <Route path="env" element={<Navigate to="/env/dashboard" replace />} />
        <Route path="env/dashboard" element={<EmissionsDashboard />} />
        <Route path="env/emission-factors" element={<EmissionFactors />} />
        <Route path="env/carbon-transactions" element={<CarbonTransactions />} />
        <Route path="env/goals" element={<Goals />} />
        <Route path="env/products" element={<ProductProfiles />} />

        {/* Person B: social + gamification routes here */}
        <Route path="social/csr-activities" element={<CSRActivityList />} />
        <Route path="social/diversity" element={<DiversityDashboard />} />
        <Route path="gamification/challenges" element={<ChallengeList />} />
        <Route path="gamification/leaderboard" element={<Leaderboard />} />
        <Route path="gamification/badges-rewards" element={<BadgesAndRewards />} />

        {/* Settings (admin/manager) */}
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
