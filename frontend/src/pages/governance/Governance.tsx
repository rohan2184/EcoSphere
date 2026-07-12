import { useSearchParams } from "react-router-dom";
import TabBar from "../../components/TabBar";
import Policies from "./Policies";
import Audits from "./Audits";
import ComplianceIssues from "./ComplianceIssues";

const TABS = [
  { key: "policies",   label: "Policies",   icon: "§" },
  { key: "audits",     label: "Audits",     icon: "✓" },
  { key: "compliance", label: "Compliance", icon: "⚠" },
];

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  "policies":   Policies,
  "audits":     Audits,
  "compliance": ComplianceIssues,
};

export default function Governance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "policies";

  function handleTabChange(key: string) {
    setSearchParams({ tab: key }, { replace: true });
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? Policies;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Governance</h1>
        <p className="text-sm text-stone-500">
          Policies, audits, compliance tracking, and risk management.
        </p>
      </div>
      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
      <ActiveComponent />
    </div>
  );
}
