import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errorMessage } from "../../lib/api";
import StatCard from "../../components/StatCard";
import ChartCard from "../../components/ChartCard";

/* ── Types ──────────────────────────────────────────────────────────── */

interface DiversityMetric {
  id: number;
  department_id: number;
  period: string;
  gender_ratio: number | null;
  avg_training_hours: number | null;
  training_completion_pct: number | null;
  created_at: string;
  updated_at: string;
}

interface TrainingAggregate {
  total_departments: number;
  avg_training_hours: number;
  avg_training_completion_pct: number;
}

interface Department {
  id: number;
  name: string;
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

const PIE_COLORS = ["#047857", "#f59e0b", "#dc2626"];
const BAR_COLORS = ["#0369a1", "#047857", "#7c3aed", "#db2777", "#ea580c", "#0891b2"];

export default function DiversityDashboard() {
  const [diversity, setDiversity] = useState<DiversityMetric[]>([]);
  const [training, setTraining] = useState<TrainingAggregate | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [socialReport, setSocialReport] = useState<SocialReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<DiversityMetric[]>("/social/diversity"),
      api.get<TrainingAggregate>("/social/training"),
      api.get<Department[]>("/departments"),
      api.get<SocialReport>("/social/report").catch(() => ({ data: null })),
    ])
      .then(([divRes, trainRes, deptRes, socialRes]) => {
        setDiversity(divRes.data);
        setTraining(trainRes.data);
        setDepartments(deptRes.data);
        setSocialReport(socialRes.data);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="text-red-600">Failed to load social insights: {error}</p>;
  if (loading) return <p className="text-stone-400">Loading…</p>;

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  // Aggregate diversity stats
  const withGender = diversity.filter((m) => m.gender_ratio !== null);
  const avgGenderRatio =
    withGender.length > 0
      ? (withGender.reduce((s, m) => s + (m.gender_ratio ?? 0), 0) / withGender.length).toFixed(1)
      : "—";

  // Latest period per department for charts
  const latestByDept = new Map<number, DiversityMetric>();
  for (const m of diversity) {
    const existing = latestByDept.get(m.department_id);
    if (!existing || m.period > existing.period) {
      latestByDept.set(m.department_id, m);
    }
  }
  const latestMetrics = Array.from(latestByDept.values());

  const genderData = latestMetrics
    .filter((m) => m.gender_ratio !== null)
    .map((m) => ({
      department: deptMap.get(m.department_id) ?? `Dept ${m.department_id}`,
      gender_ratio: m.gender_ratio,
    }));

  const trainingHoursData = latestMetrics
    .filter((m) => m.avg_training_hours !== null)
    .map((m) => ({
      department: deptMap.get(m.department_id) ?? `Dept ${m.department_id}`,
      avg_training_hours: m.avg_training_hours,
    }));

  const trainingPctData = latestMetrics
    .filter((m) => m.training_completion_pct !== null)
    .map((m) => ({
      department: deptMap.get(m.department_id) ?? `Dept ${m.department_id}`,
      training_completion_pct: m.training_completion_pct,
    }));

  const approvalPieData = socialReport
    ? [
        { name: "Approved", value: socialReport.approved_participations },
        { name: "Pending", value: socialReport.pending_participations },
        { name: "Rejected", value: socialReport.rejected_participations },
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

      {/* ── Stat Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Avg Gender Ratio"
          value={avgGenderRatio === "—" ? "—" : `${avgGenderRatio}%`}
          sub="50% = balanced"
          accent="text-violet-700"
        />
        <StatCard
          label="Avg Training Hours"
          value={training ? training.avg_training_hours.toFixed(1) : "—"}
          accent="text-sky-700"
        />
        <StatCard
          label="Training Completion"
          value={training ? `${training.avg_training_completion_pct.toFixed(1)}%` : "—"}
          accent="text-emerald-700"
        />
        <StatCard
          label="Departments Tracked"
          value={training ? training.total_departments : latestMetrics.length}
          accent="text-stone-700"
        />
      </div>

      {/* ── Diversity Charts ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Gender Ratio by Department */}
        <ChartCard title="Gender Ratio by Department">
          {genderData.length === 0 ? (
            <p className="text-sm text-stone-400">No gender ratio data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={genderData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="department" type="category" fontSize={11} width={120} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="gender_ratio" name="Gender Ratio %" fill="#7c3aed" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {genderData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Training Completion % by Department */}
        <ChartCard title="Training Completion by Department">
          {trainingPctData.length === 0 ? (
            <p className="text-sm text-stone-400">No training completion data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trainingPctData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="department" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar
                  dataKey="training_completion_pct"
                  name="Completion %"
                  fill="#047857"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Avg Training Hours by Department */}
      {trainingHoursData.length > 0 && (
        <ChartCard title="Average Training Hours by Department">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trainingHoursData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={12} />
              <YAxis dataKey="department" type="category" fontSize={11} width={120} />
              <Tooltip formatter={(v: number) => `${v} hrs`} />
              <Bar
                dataKey="avg_training_hours"
                name="Avg Hours"
                fill="#0369a1"
                radius={[0, 3, 3, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── CSR Participation (from social report) ────────────── */}
      {socialReport && (
        <>
          <div className="border-t border-stone-200 pt-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">CSR Participation</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="CSR Activities" value={socialReport.total_csr_activities} accent="text-sky-700" />
            <StatCard label="Total Participations" value={socialReport.total_participations} accent="text-stone-700" />
            <StatCard
              label="Participation Rate"
              value={`${(socialReport.participation_rate * 100).toFixed(1)}%`}
              accent="text-emerald-700"
            />
            <StatCard label="Points Awarded" value={socialReport.total_points_awarded.toLocaleString()} accent="text-violet-700" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Participation by Activity */}
            <ChartCard title="Participation by Activity">
              {socialReport.activities.length === 0 ? (
                <p className="text-sm text-stone-400">No activity data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={socialReport.activities} layout="vertical">
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
        </>
      )}
    </div>
  );
}
