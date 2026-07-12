import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Dialog, Input } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/ToastProvider";
import DataTable, { Column } from "../../components/DataTable";

type DiversityMetric = Record<string, unknown> & {
  id: number;
  department_id: number;
  period: string;
  gender_ratio: number | null;
  avg_training_hours: number | null;
  training_completion_pct: number | null;
  created_at: string;
  updated_at: string;
};

interface Department {
  id: number;
  name: string;
}

export default function DiversityMetrics() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === "admin";

  const [metrics, setMetrics] = useState<DiversityMetric[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [deptId, setDeptId] = useState("");
  const [period, setPeriod] = useState("");
  const [genderRatio, setGenderRatio] = useState("");
  const [trainingHours, setTrainingHours] = useState("");
  const [trainingPct, setTrainingPct] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, deptsRes] = await Promise.all([
        api.get<DiversityMetric[]>("/social/diversity"),
        api.get<Department[]>("/departments"),
      ]);
      setMetrics(metricsRes.data);
      setDepartments(deptsRes.data);
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-stone-500">
        <h2 className="text-xl font-medium">Access Denied</h2>
        <p className="mt-2">Only administrators can view and manage Diversity Metrics.</p>
      </div>
    );
  }

  const openCreateDialog = () => {
    setEditingId(null);
    setDeptId("");
    setPeriod("");
    setGenderRatio("");
    setTrainingHours("");
    setTrainingPct("");
    setDialogOpen(true);
  };

  const openEditDialog = (m: DiversityMetric) => {
    setEditingId(m.id);
    setDeptId(m.department_id.toString());
    setPeriod(m.period);
    setGenderRatio(m.gender_ratio?.toString() || "");
    setTrainingHours(m.avg_training_hours?.toString() || "");
    setTrainingPct(m.training_completion_pct?.toString() || "");
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this metric permanently?")) return;
    try {
      await api.delete(`/social/diversity/${id}`);
      showToast("Metric deleted", "green");
      fetchData();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  };

  const handleSave = async () => {
    if (!deptId || !period) {
      showToast("Department and Period are required.", "red");
      return;
    }

    const payload = {
      department_id: parseInt(deptId, 10),
      period,
      gender_ratio: genderRatio ? parseFloat(genderRatio) : null,
      avg_training_hours: trainingHours ? parseFloat(trainingHours) : null,
      training_completion_pct: trainingPct ? parseFloat(trainingPct) : null,
    };

    try {
      if (editingId) {
        await api.patch(`/social/diversity/${editingId}`, payload);
        showToast("Metric updated successfully", "green");
      } else {
        await api.post("/social/diversity", payload);
        showToast("Metric created successfully", "green");
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      // Show clear duplicate period error
      const msg = errorMessage(err);
      if (msg.includes("already exists")) {
        showToast("A metric for this department and period already exists.", "red");
      } else if (err.response?.status === 422) {
         showToast("Validation Error. Ensure period format is YYYY-Q[1-4] and gender ratio is 0-100.", "red");
      } else {
        showToast(msg, "red");
      }
    }
  };

  const deptMap = new Map(departments.map(d => [d.id, d.name]));

  const columns: Column<DiversityMetric>[] = [
    {
      key: "department_id",
      label: "Department",
      render: (r) => deptMap.get(r.department_id) || `ID: ${r.department_id}`,
    },
    { key: "period", label: "Period" },
    {
      key: "gender_ratio",
      label: "Gender Ratio (%)",
      render: (r) => (r.gender_ratio !== null ? r.gender_ratio : "—"),
    },
    {
      key: "avg_training_hours",
      label: "Avg Training Hrs",
      render: (r) => (r.avg_training_hours !== null ? r.avg_training_hours : "—"),
    },
    {
      key: "training_completion_pct",
      label: "Training Completion (%)",
      render: (r) => (r.training_completion_pct !== null ? r.training_completion_pct : "—"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex gap-2">
          <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => openEditDialog(r as DiversityMetric)}>
            Edit
          </Button>
          <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => handleDelete(r.id as number)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Diversity Metrics</h1>
          <p className="text-stone-500 mt-1">Manage diversity and training metrics across departments.</p>
        </div>
        <Button onClick={openCreateDialog}>Add Metric</Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-stone-100 rounded-lg w-full"></div>
          <div className="h-32 bg-stone-50 rounded-lg w-full"></div>
        </div>
      ) : metrics.length === 0 ? (
        <EmptyState
          title="No metrics found"
          description="You haven't added any diversity metrics yet."
          actionLabel="Add Metric"
          onAction={openCreateDialog}
        />
      ) : (
        <DataTable columns={columns} rows={metrics} />
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Edit Metric" : "Add Metric"}>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Department</label>
            <select
              className="w-full rounded-md border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
            >
              <option value="" disabled>Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Period (e.g. 2026-Q2)</label>
            <Input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="YYYY-Q[1-4]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Gender Ratio</label>
            <Input
              type="number"
              value={genderRatio}
              onChange={(e) => setGenderRatio(e.target.value)}
              placeholder="% of one gender (0-100)"
            />
            <p className="text-xs text-stone-500 mt-1">% of one gender, 0-100 — 50 = balanced</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Avg Training Hours</label>
            <Input
              type="number"
              value={trainingHours}
              onChange={(e) => setTrainingHours(e.target.value)}
              placeholder="e.g. 15.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Training Completion (%)</label>
            <Input
              type="number"
              value={trainingPct}
              onChange={(e) => setTrainingPct(e.target.value)}
              placeholder="e.g. 85.0"
            />
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Metric</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
