interface Tab {
  key: string;
  label: string;
  icon?: string;
}

export default function TabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-stone-200">
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "text-emerald-700"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </span>
            {active && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600" />
            )}
          </button>
        );
      })}
    </div>
  );
}
