import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, RadialBar, RadialBarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errorMessage } from "../../lib/api";
import StatCard from "../../components/StatCard";
import ChartCard from "../../components/ChartCard";
import DataTable from "../../components/DataTable";
import { Chip } from "../../components/ui";

interface DeptScore extends Record<string, unknown> {
  department_id: number;
  department_name: string;
  employee_count: number;
  environmental_score: number;
  social_score: number;
  governance_score: number;
  total_score: number;
}

interface Overview {
  overall_score: number;
  environmental_score: number;
  social_score: number;
  governance_score: number;
  weights: { env: number; social: number; gov: number };
  department_ranking: DeptScore[];
  compliance_alerts: { issue_id: number; severity: string; description: string; due_date: string }[];
  recent_notifications: { id: number; type: string; title: string; is_read: boolean }[];
}

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Overview>("/dashboard/overview")
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="text-red-600">Failed to load dashboard: {error}</p>;
  if (!data) return <p className="text-stone-400">Loading…</p>;

  const gauge = [{ name: "ESG", value: data.overall_score, fill: "#047857" }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Organization Dashboard</h1>
        <p className="text-sm text-stone-500">
          Live ESG scores · weights E/S/G = {data.weights.env}/{data.weights.social}/{data.weights.gov}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Overall ESG" value={data.overall_score} sub="weighted by headcount" />
        <StatCard label="Environmental" value={data.environmental_score} accent="text-green-700" />
        <StatCard label="Social" value={data.social_score} accent="text-sky-700" />
        <StatCard label="Governance" value={data.governance_score} accent="text-violet-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Overall ESG Score">
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart data={gauge} innerRadius="70%" outerRadius="100%" startAngle={210} endAngle={-30}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#e7e5e4" }} isAnimationActive={false} />
              <text x="50%" y="52%" textAnchor="middle" className="fill-emerald-800 text-3xl font-bold">
                {data.overall_score}
              </text>
              <text x="50%" y="66%" textAnchor="middle" className="fill-stone-400 text-xs">
                out of 100
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="E / S / G by Department">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.department_ranking}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="department_name" fontSize={12} />
              <YAxis domain={[0, 100]} fontSize={12} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="environmental_score" name="Env" fill="#15803d" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="social_score" name="Social" fill="#0369a1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="governance_score" name="Gov" fill="#6d28d9" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Department Ranking">
        <DataTable<DeptScore>
          columns={[
            { key: "rank", label: "#", render: (r) => data.department_ranking.indexOf(r) + 1 },
            { key: "department_name", label: "Department" },
            { key: "employee_count", label: "Employees" },
            { key: "environmental_score", label: "Env" },
            { key: "social_score", label: "Social" },
            { key: "governance_score", label: "Gov" },
            {
              key: "total_score", label: "Total",
              render: (r) => <span className="font-semibold text-emerald-800">{r.total_score}</span>,
            },
          ]}
          rows={data.department_ranking}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Compliance Alerts (overdue)">
          {data.compliance_alerts.length === 0 ? (
            <p className="text-sm text-stone-400">Nothing overdue. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data.compliance_alerts.map((a) => (
                <li key={a.issue_id} className="flex items-start gap-2 text-sm">
                  <Chip tone={a.severity === "critical" || a.severity === "high" ? "red" : "amber"}>{a.severity}</Chip>
                  <span className="flex-1">{a.description}</span>
                  <span className="text-xs text-stone-400">due {a.due_date}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Recent Notifications">
          {data.recent_notifications.length === 0 ? (
            <p className="text-sm text-stone-400">No notifications.</p>
          ) : (
            <ul className="space-y-2">
              {data.recent_notifications.map((n) => (
                <li key={n.id} className="flex items-center gap-2 text-sm">
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                  <span className={n.is_read ? "text-stone-400" : ""}>{n.title}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
