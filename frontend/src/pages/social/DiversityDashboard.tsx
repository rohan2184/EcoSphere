import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errorMessage } from "../../lib/api";
import StatCard from "../../components/StatCard";
import ChartCard from "../../components/ChartCard";

/* ── Types ──────────────────────────────────────────────────────── */

interface DiversityMetric {
  id: number;
  department_id: number;
  period: string;
  gender_ratio: number | null;
  avg_training_hours: number | null;
  training_completion_pct: number | null;
}

interface TrainingAggregate {
  avg_training_hours: number;
  training_completion_pct: number;
  total_records: number;
}

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

interface Department {
  id: number;
  name: string;
}

const GENDER_COLORS = ["#047857", "#0ea5e9"];
const PIE_COLORS = ["#047857", "#f59e0b", "#dc2626"];

export default function DiversityDashboard() {
  const [diversity, setDiversity] = useState<DiversityMetric[]>([]);
  const [training, setTraining] = useState<TrainingAggregate | null>(null);
  const [social, setSocial] = useState<SocialReport | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<DiversityMetric[]>("/social/diversity"),
      api.get<TrainingAggregate>("/social/training"),
      api.get<SocialReport>("/social/report").catch(() => ({ data: null })),
      api.get<Department[]>("/departments").catch(() => ({ data: [] as Department[] })),
    ])
      .then(([divRes, trainRes, socialRes, deptRes]) => {
        setDiversity(divRes.data);
        setTraining(trainRes.data);
        setSocial(socialRes.data as SocialReport | null);
        setDepartments(deptRes.data);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="text-red-600">Failed to load social insights: {error}</p>;
  if (!training) return <p className="text-stone-400">Loading…</p>;

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  // Compute overall gender ratio from diversity metrics
  const validGender = diversity.filter((d) => d.gender_ratio != null);
  const avgGenderRatio =
    validGender.length > 0
      ? validGender.reduce((s, d) => s + (d.gender_ratio ?? 0), 0) / validGender.length
      : null;

  // Gender pie data
  const genderPieData =
    avgGenderRatio !== null
      ? [
          { name: "Female %", value: Math.round(avgGenderRatio) },
          { name: "Male %", value: 100 - Math.round(avgGenderRatio) },
        ]
      : [];

  // Training by department (bar chart)
  const trainingByDept = diversity
    .filter((d) => d.avg_training_hours != null)
    .map((d) => ({
      department: deptMap.get(d.department_id) ?? `Dept #${d.department_id}`,
      period: d.period,
      hours: d.avg_training_hours ?? 0,
      completion: d.training_completion_pct ?? 0,
    }));

  // CSR approval pie
  const approvalPieData = social
    ? [
        { name: "Approved", value: social.approved_participations },
        { name: "Pending", value: social.pending_participations },
        { name: "Rejected", value: social.rejected_participations },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Social Insights</h1>
        <p className="text-sm text-stone-500">
          Diversity metrics, training progress, and CSR participation overview.
        </p>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Gender Ratio"
          value={avgGenderRatio !== null ? `${avgGenderRatio.toFixed(1)}%` : "—"}
          accent="text-teal-700"
        />
        <StatCard
          label="Avg Training Hours"
          value={training.avg_training_hours.toFixed(1)}
          accent="text-sky-700"
        />
        <StatCard
          label="Training Completion"
          value={`${training.training_completion_pct.toFixed(1)}%`}
          accent="text-emerald-700"
        />
        <StatCard
          label="CSR Activities"
          value={social?.total_csr_activities ?? "—"}
          accent="text-violet-700"
        />
      </div>

      {/* ── Charts row 1: Gender + Training Hours ────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Gender Ratio (avg across departments)">
          {genderPieData.length === 0 ? (
            <p className="text-sm text-stone-400">No gender data available.</p>
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={genderPieData}
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
                    {genderPieData.map((_, i) => (
                      <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Avg Training Hours by Department">
          {trainingByDept.length === 0 ? (
            <p className="text-sm text-stone-400">No training data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trainingByDept} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} />
                <YAxis
                  dataKey="department"
                  type="category"
                  fontSize={11}
                  width={120}
                />
                <Tooltip />
                <Bar
                  dataKey="hours"
                  name="Avg Hours"
                  fill="#0369a1"
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 2: Training Completion + CSR Approval ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Training Completion % by Department">
          {trainingByDept.length === 0 ? (
            <p className="text-sm text-stone-400">No training data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trainingByDept}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="department" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Bar
                  dataKey="completion"
                  name="Completion %"
                  fill="#047857"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {social && (
          <ChartCard title="CSR Participation Approval Status">
            {approvalPieData.length === 0 ? (
              <p className="text-sm text-stone-400">No participation data available.</p>
            ) : (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={approvalPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
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
        )}
      </div>
    </div>
  );
}
