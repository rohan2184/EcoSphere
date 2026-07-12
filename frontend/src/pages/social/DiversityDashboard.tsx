import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errorMessage } from "../../lib/api";
import StatCard from "../../components/StatCard";
import ChartCard from "../../components/ChartCard";

interface CSRActivityBreakdown {
  activity_title: string;
  participant_count: number;
  approval_rate: number;
}

interface SocialReport {
  total_csr_activities: number;
  total_participations: number;
  approved_participations: number;
  pending_participations: number;
  rejected_participations: number;
  total_points_awarded: number;
  participation_rate: number;
  activities: CSRActivityBreakdown[];
}

const PIE_COLORS = ["#047857", "#f59e0b", "#dc2626"];

export default function DiversityDashboard() {
  const [data, setData] = useState<SocialReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<SocialReport>("/social/report")
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="text-red-600">Failed to load social insights: {error}</p>;
  if (!data) return <p className="text-stone-400">Loading…</p>;

  const approvalPieData = [
    { name: "Approved", value: data.approved_participations },
    { name: "Pending", value: data.pending_participations },
    { name: "Rejected", value: data.rejected_participations },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Social Insights</h1>
        <p className="text-sm text-stone-500">
          CSR participation metrics and social engagement overview.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="CSR Activities" value={data.total_csr_activities} accent="text-sky-700" />
        <StatCard label="Total Participations" value={data.total_participations} accent="text-stone-700" />
        <StatCard
          label="Participation Rate"
          value={`${(data.participation_rate * 100).toFixed(1)}%`}
          accent="text-emerald-700"
        />
        <StatCard label="Points Awarded" value={data.total_points_awarded.toLocaleString()} accent="text-violet-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Participation by Activity */}
        <ChartCard title="Participation by Activity">
          {data.activities.length === 0 ? (
            <p className="text-sm text-stone-400">No activity data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.activities} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="activity_title" type="category" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="participant_count" name="Participants" fill="#0369a1" radius={[0, 3, 3, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Approval Status Breakdown */}
        <ChartCard title="Participation Approval Status">
          {approvalPieData.length === 0 ? (
            <p className="text-sm text-stone-400">No participation data available.</p>
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={approvalPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    isAnimationActive={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {approvalPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Activity Approval Rates */}
      {data.activities.length > 0 && (
        <ChartCard title="Approval Rate by Activity">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.activities}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="activity_title" fontSize={11} />
              <YAxis domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
              <Bar
                dataKey="approval_rate"
                name="Approval Rate"
                fill="#047857"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Backend gap notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Note:</strong> Full diversity metrics (gender ratio, training hours, training completion %)
        require additional backend endpoints. This view shows available CSR participation data from the social report.
      </div>
    </div>
  );
}
