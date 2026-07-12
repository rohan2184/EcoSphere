import { useSearchParams } from "react-router-dom";
import TabBar from "../../components/TabBar";
import CSRActivityList from "./CSRActivityList";
import DiversityDashboard from "./DiversityDashboard";

const TABS = [
  { key: "csr-activities", label: "CSR Activities", icon: "♻" },
  { key: "diversity",      label: "Diversity",      icon: "👥" },
];

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  "csr-activities": CSRActivityList,
  "diversity":      DiversityDashboard,
};

export default function Social() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "csr-activities";

  function handleTabChange(key: string) {
    setSearchParams({ tab: key }, { replace: true });
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? CSRActivityList;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Social</h1>
        <p className="text-sm text-stone-500">
          CSR initiatives, diversity metrics, and employee engagement.
        </p>
      </div>
      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
      <ActiveComponent />
    </div>
  );
}
