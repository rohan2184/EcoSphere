import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import { Button, Chip, Dialog, Input, Select, Toast } from "../../components/ui";

const SOURCE_TYPES = ["purchase", "manufacturing", "expense", "fleet"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

interface CarbonTransaction extends Record<string, unknown> {
  id: number;
  department_id: number;
  source_type: SourceType;
  source_ref: string | null;
  quantity: number;
  emission_factor_id: number;
  co2e_amount: number;
  date: string;
  auto_generated: boolean;
}

interface Department {
  id: number;
  name: string;
}

interface EmissionFactor {
  id: number;
  name: string;
  source_type: SourceType;
  unit: string;
  factor_value: number;
}

interface Settings {
  auto_emission_calc: boolean;
}

interface FormState {
  department_id: string;
  source_type: SourceType;
  source_ref: string;
  emission_factor_id: string;
  quantity: string;
  co2e_amount: string;
  date: string;
}

function today(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    department_id: "",
    source_type: "purchase",
    source_ref: "",
    emission_factor_id: "",
    quantity: "",
    co2e_amount: "",
    date: today(),
  };
}

export default function CarbonTransactions() {
  const [rows, setRows] = useState<CarbonTransaction[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [autoCalc, setAutoCalc] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);

  // Filters
  const [filterDept, setFilterDept] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const deptName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [departments]);

  const factorName = useMemo(() => {
    const map = new Map(factors.map((f) => [f.id, f.name]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [factors]);

  // Fetch reference data + settings once on mount.
  useEffect(() => {
    Promise.all([
      api.get<Settings>("/settings"),
      api.get<Department[]>("/departments"),
      api.get<EmissionFactor[]>("/env/emission-factors"),
    ])
      .then(([s, d, f]) => {
        setAutoCalc(s.data.auto_emission_calc);
        setDepartments(d.data);
        setFactors(f.data);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params: Record<string, string> = {};
    if (filterDept) params.department_id = filterDept;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    api
      .get<CarbonTransaction[]>("/env/carbon-transactions", { params })
      .then((r) => setRows(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [filterDept, dateFrom, dateTo]);

  // Re-fetch whenever a filter changes.
  useEffect(load, [load]);

  // Emission factors sorted so ones matching the selected source_type come first.
  const sortedFactors = useMemo(() => {
    return [...factors].sort((a, b) => {
      const am = a.source_type === form.source_type ? 0 : 1;
      const bm = b.source_type === form.source_type ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.name.localeCompare(b.name);
    });
  }, [factors, form.source_type]);

  function openAdd() {
    setForm(emptyForm());
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        department_id: Number(form.department_id),
        source_type: form.source_type,
        source_ref: form.source_ref || null,
        quantity: Number(form.quantity),
        emission_factor_id: Number(form.emission_factor_id),
        // Backend overrides this when auto_emission_calc is on; send 0 as a placeholder.
        co2e_amount: autoCalc ? 0 : Number(form.co2e_amount),
        date: form.date,
      };
      await api.post("/env/carbon-transactions", payload);
      setToast({ message: "Transaction added.", tone: "green" });
      setDialogOpen(false);
      load();
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  const hasActiveFilters = filterDept || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-stone-800">Carbon Transactions</h1>
            {autoCalc !== null && (
              <Chip tone={autoCalc ? "green" : "neutral"}>
                Auto-calc: {autoCalc ? "ON" : "OFF"}
              </Chip>
            )}
          </div>
          <p className="text-sm text-stone-500">Recorded emission events and their CO₂e footprint.</p>
        </div>
        <Button onClick={openAdd}>+ Add Transaction</Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Department</label>
          <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Date From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-600">Date To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilterDept("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
          Loading transactions…
        </div>
      ) : (
        <DataTable<CarbonTransaction>
          columns={[
            { key: "date", label: "Date" },
            { key: "department", label: "Department", render: (r) => deptName(r.department_id) },
            {
              key: "source_type",
              label: "Source Type",
              render: (r) => <Chip>{r.source_type}</Chip>,
            },
            {
              key: "quantity",
              label: "Quantity",
              render: (r) => <span className="tabular-nums">{r.quantity}</span>,
            },
            { key: "emission_factor", label: "Emission Factor", render: (r) => factorName(r.emission_factor_id) },
            {
              key: "co2e_amount",
              label: "CO₂e (kg)",
              render: (r) => <span className="tabular-nums font-medium">{r.co2e_amount}</span>,
            },
            {
              key: "auto_generated",
              label: "Auto",
              render: (r) =>
                r.auto_generated ? <Chip tone="green">⚙ auto</Chip> : <Chip tone="neutral">manual</Chip>,
            },
          ]}
          rows={rows}
          empty={
            hasActiveFilters
              ? "No transactions match these filters."
              : "No transactions yet — add one to start tracking emissions."
          }
        />
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Transaction">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Department</label>
              <Select
                required
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full"
              >
                <option value="" disabled>Select…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Source Type</label>
              <Select
                value={form.source_type}
                onChange={(e) => setForm({ ...form, source_type: e.target.value as SourceType })}
                className="w-full"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Source Ref <span className="text-stone-400">(optional)</span></label>
            <Input
              placeholder="e.g. INV-2043"
              value={form.source_ref}
              onChange={(e) => setForm({ ...form, source_ref: e.target.value })}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Emission Factor</label>
            <Select
              required
              value={form.emission_factor_id}
              onChange={(e) => setForm({ ...form, emission_factor_id: e.target.value })}
              className="w-full"
            >
              <option value="" disabled>Select…</option>
              {sortedFactors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.factor_value} kg/{f.unit} ({f.source_type})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Quantity</label>
              <Input
                required
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 120"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">CO₂e Amount</label>
              <Input
                required={autoCalc === false}
                disabled={autoCalc !== false}
                type="number"
                step="any"
                min="0"
                placeholder={autoCalc !== false ? "Calculated automatically" : "e.g. 321.6"}
                value={autoCalc !== false ? "" : form.co2e_amount}
                onChange={(e) => setForm({ ...form, co2e_amount: e.target.value })}
                className={`w-full ${autoCalc !== false ? "bg-stone-100 text-stone-400" : ""}`}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Date</label>
            <Input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add transaction"}</Button>
          </div>
        </form>
      </Dialog>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}
