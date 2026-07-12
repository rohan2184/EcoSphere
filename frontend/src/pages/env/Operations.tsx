import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import EmptyState from "../../components/EmptyState";
import { Button, Chip, Dialog, Input, Select } from "../../components/ui";
import { useToast } from "../../components/ToastProvider";

/* ── Types ──────────────────────────────────────────────────────────── */

const OP_TYPES = ["purchase", "manufacturing", "expense", "fleet"] as const;
type OpType = (typeof OP_TYPES)[number];

interface OperationRecord extends Record<string, unknown> {
  id: number;
  op_type: OpType;
  department_id: number;
  product_id: number | null;
  quantity: number;
  amount: number;
  date: string;
  created_at: string;
}

interface CarbonTransactionOut {
  id: number;
  department_id: number;
  emission_factor_id: number;
  source_type: string;
  quantity: number;
  co2e_kg: number;
  date: string;
}

interface OperationWithTxn {
  operation: OperationRecord;
  carbon_transaction: CarbonTransactionOut | null;
  warning: string | null;
}

interface Department {
  id: number;
  name: string;
}

interface Product {
  id: number;
  product_name: string;
}

interface FormState {
  op_type: OpType;
  department_id: string;
  product_id: string;
  quantity: string;
  amount: string;
  date: string;
}

const EMPTY_FORM: FormState = {
  op_type: "purchase",
  department_id: "",
  product_id: "",
  quantity: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
};

const OP_TYPE_LABELS: Record<OpType, string> = {
  purchase: "Purchase",
  manufacturing: "Manufacturing",
  expense: "Expense",
  fleet: "Fleet",
};

const OP_TYPE_ICONS: Record<OpType, string> = {
  purchase: "🛒",
  manufacturing: "🏭",
  expense: "💰",
  fleet: "🚛",
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200 ${className}`} />;
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function Operations() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<OperationRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterOpType, setFilterOpType] = useState("");
  const [filterDeptId, setFilterDeptId] = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OperationRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const deptMap = new Map(departments.map((d) => [d.id, d.name]));
  const productMap = new Map(products.map((p) => [p.id, p.product_name]));

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filterOpType) params.set("op_type", filterOpType);
    if (filterDeptId) params.set("department_id", filterDeptId);
    api
      .get<OperationRecord[]>(`/env/operations?${params}`)
      .then((r) => setRows(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [filterOpType, filterDeptId]);

  useEffect(() => {
    Promise.all([
      api.get<Department[]>("/departments"),
      api.get<Product[]>("/env/products"),
    ]).then(([depts, prods]) => {
      setDepartments(depts.data);
      setProducts(prods.data);
    }).catch(() => {});
  }, []);

  useEffect(load, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: OperationRecord) {
    setEditing(row);
    setForm({
      op_type: row.op_type,
      department_id: String(row.department_id),
      product_id: row.product_id ? String(row.product_id) : "",
      quantity: String(row.quantity),
      amount: String(row.amount),
      date: row.date,
    });
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.department_id) {
      showToast("Department is required.", "red");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        op_type: form.op_type,
        department_id: Number(form.department_id),
        product_id: form.product_id ? Number(form.product_id) : null,
        quantity: Number(form.quantity),
        amount: Number(form.amount),
        date: form.date,
      };
      if (editing) {
        await api.put(`/env/operations/${editing.id}`, payload);
        showToast("Operation updated.", "green");
      } else {
        const { data } = await api.post<OperationWithTxn>("/env/operations", payload);
        if (data.carbon_transaction) {
          showToast(
            `Operation created → auto-generated carbon transaction: ${data.carbon_transaction.co2e_kg.toFixed(2)} kg CO₂e`,
            "green",
          );
        } else if (data.warning) {
          showToast(`Operation created. ⚠ ${data.warning}`, "green");
        } else {
          showToast("Operation created (auto-calc disabled).", "green");
        }
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      showToast(errorMessage(err), "red");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: OperationRecord) {
    if (!confirm(`Delete this ${row.op_type} operation (#${row.id})?`)) return;
    try {
      await api.delete(`/env/operations/${row.id}`);
      showToast("Operation deleted.", "green");
      load();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Operations</h1>
          <p className="text-sm text-stone-500">
            Purchase, manufacturing, expense, and fleet records — auto-linked to carbon transactions.
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Operation</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
        <label className="text-sm text-stone-600">
          Type
          <Select
            value={filterOpType}
            onChange={(e) => setFilterOpType(e.target.value)}
            className="mt-1 block"
          >
            <option value="">All</option>
            {OP_TYPES.map((t) => (
              <option key={t} value={t}>
                {OP_TYPE_ICONS[t]} {OP_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm text-stone-600">
          Department
          <Select
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
            className="mt-1 block"
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>Failed to load: {error}</span>
          <button onClick={load} className="underline hover:text-red-900 ml-4">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
          <SkeletonBlock className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 && !error ? (
        <EmptyState
          icon="📋"
          title="No operations recorded"
          description="Add your first operation record to start tracking purchases, manufacturing, expenses, or fleet activities."
          actionLabel="+ Add Operation"
          onAction={openAdd}
        />
      ) : (
        <DataTable<OperationRecord>
          columns={[
            { key: "id", label: "ID" },
            {
              key: "op_type",
              label: "Type",
              render: (r) => (
                <Chip tone={r.op_type === "fleet" ? "amber" : r.op_type === "manufacturing" ? "green" : "neutral"}>
                  {OP_TYPE_ICONS[r.op_type]} {OP_TYPE_LABELS[r.op_type]}
                </Chip>
              ),
            },
            {
              key: "department_id",
              label: "Department",
              render: (r) => deptMap.get(r.department_id) ?? `Dept #${r.department_id}`,
            },
            {
              key: "product_id",
              label: "Product",
              render: (r) =>
                r.product_id ? (productMap.get(r.product_id) ?? `#${r.product_id}`) : "—",
            },
            {
              key: "quantity",
              label: "Quantity",
              render: (r) => <span className="tabular-nums">{r.quantity}</span>,
            },
            {
              key: "amount",
              label: "Amount",
              render: (r) => <span className="tabular-nums">{r.amount.toLocaleString()}</span>,
            },
            { key: "date", label: "Date" },
            {
              key: "actions",
              label: "",
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => openEdit(r)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => remove(r)}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
          rows={rows}
          empty="No operations match these filters."
        />
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Operation" : "Add Operation"}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Operation Type</label>
            <Select
              value={form.op_type}
              onChange={(e) => setForm({ ...form, op_type: e.target.value as OpType })}
              className="w-full"
            >
              {OP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {OP_TYPE_ICONS[t]} {OP_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Department</label>
            <Select
              required
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="w-full"
            >
              <option value="" disabled>
                Select department
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Product (optional)</label>
            <Select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full"
            >
              <option value="">None</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name}
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
                placeholder="e.g. 100"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-stone-600">Amount</label>
              <Input
                required
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 5000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full"
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
          {!editing && (
            <p className="text-xs text-stone-400">
              💡 If auto-emission calculation is enabled, a carbon transaction will be generated automatically.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add operation"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
