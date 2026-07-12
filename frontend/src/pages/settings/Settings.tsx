import { useState } from "react";
import TabBar from "../../components/TabBar";
import DepartmentsTab from "./DepartmentsTab";
import CategoriesTab from "./CategoriesTab";
import ESGConfigTab from "./ESGConfigTab";
import NotificationSettingsTab from "./NotificationSettingsTab";

const TABS = [
  { key: "departments", label: "Departments", icon: "🏢" },
  { key: "categories", label: "Categories", icon: "🏷" },
  { key: "esg", label: "ESG Configuration", icon: "⚖" },
  { key: "notifications", label: "Notification Settings", icon: "🔔" },
];

export default function Settings() {
  const [tab, setTab] = useState("departments");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Settings</h1>
        <p className="text-sm text-stone-500">
          Manage departments, categories, ESG weights, and notification
          preferences.
        </p>
      </div>

      <TabBar tabs={TABS} activeTab={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === "departments" && <DepartmentsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "esg" && <ESGConfigTab />}
        {tab === "notifications" && <NotificationSettingsTab />}
      </div>
    </div>
  );
}
