import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errorMessage } from "../../lib/api";
import StatCard from "../../components/StatCard";
import ChartCard from "../../components/ChartCard";

interface EnvDashboard {
  total_co2e: number;
  transaction_count: number;
  by_department: { department: string; co2e: number }[];
  by_source_type: { source_type: string; co2e: number }[];
  monthly_trend: { month: string; co2e: number }[];
}

export default function EmissionsDashboard() {
  const [data, setData] = useState<EnvDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<EnvDashboard>("/env/dashboard")
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="text-red-600">Failed to load env dashboard: {error}</p>;
  if (!data) return <p className="text-stone-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Emissions Dashboard</h1>
        <p className="text-sm text-stone-500">Carbon footprint across departments, sources and time.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total CO₂e" value={`${data.total_co2e.toLocaleString()} kg`} />
        <StatCard label="Transactions" value={data.transaction_count} accent="text-stone-700" />
        <StatCard label="Departments" value={data.by_department.length} accent="text-stone-700" />
        <StatCard label="Source types" value={data.by_source_type.length} accent="text-stone-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Emissions by Department (kg CO₂e)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.by_department}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="department" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="co2e" name="CO₂e" fill="#15803d" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Emissions by Source Type (kg CO₂e)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.by_source_type}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="source_type" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="co2e" name="CO₂e" fill="#0369a1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Monthly Emissions Trend (kg CO₂e)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.monthly_trend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="co2e" name="CO₂e" stroke="#047857" strokeWidth={2} dot isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
