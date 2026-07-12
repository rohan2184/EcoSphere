import { useSearchParams } from "react-router-dom";
import TabBar from "../../components/TabBar";
import EmissionsDashboard from "./EmissionsDashboard";
import EmissionFactors from "./EmissionFactors";
import ProductProfiles from "./ProductProfiles";
import CarbonTransactions from "./CarbonTransactions";
import Operations from "./Operations";
import Goals from "./Goals";

const TABS = [
  { key: "emissions",           label: "Emissions",           icon: "🌍" },
  { key: "emission-factors",    label: "Emission Factors",    icon: "🏭" },
  { key: "product-profiles",    label: "Product Profiles",    icon: "📦" },
  { key: "carbon-transactions", label: "Carbon Transactions", icon: "💨" },
  { key: "operations",          label: "Operations",          icon: "📋" },
  { key: "goals",               label: "Goals",               icon: "🎯" },
];

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  "emissions":           EmissionsDashboard,
  "emission-factors":    EmissionFactors,
  "product-profiles":    ProductProfiles,
  "carbon-transactions": CarbonTransactions,
  "operations":          Operations,
  "goals":               Goals,
};

export default function Environmental() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "emissions";

  function handleTabChange(key: string) {
    setSearchParams({ tab: key }, { replace: true });
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? EmissionsDashboard;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Environmental</h1>
        <p className="text-sm text-stone-500">
          Track emissions, manage products, and monitor environmental goals.
        </p>
      </div>
      <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
      <ActiveComponent />
    </div>
  );
}
