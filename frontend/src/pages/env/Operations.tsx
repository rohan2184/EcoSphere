import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import DataTable from "../../components/DataTable";
import EmptyState from "../../components/EmptyState";
import { Button, Chip, Dialog, Input, Select } from "../../components/ui";
import { useToast } from "../../components/ToastProvider";

const SOURCE_TYPES = ["purchase", "manufacturing", "expense", "fleet"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

interface OperationRecord extends Record<string, unknown> {
  id: number;
  op_type: SourceType;
  department_id: number;
  product_id: number | null;
  quantity: number;
  amount: number;
  date: string;
  created_at: string;
}

interface DeptOption {
  department_id: number;
  department_name: string;
}

interface ProductOption {
  id: number;
  product_name: string;
}

interface FormState {
  op_type: SourceType;
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

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-stone-200 ${className}`} />;
}

export default function Operations() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<OperationRecord[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OperationRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* Result dialog — shown after successful create showing the auto-generated transaction */
  const [resultDialog, setResultDialog] = useState<{
    operation: OperationRecord;
    carbon_transaction: Record<string, unknown> | null;
    warning: string | null;
  } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<OperationRecord[]>("/env/operations"),
      api.get<DeptOption[]>("/dashboard/scores").catch(() => ({ data: [] as DeptOption[] })),
      api.get<ProductOption[]>("/env/products").catch(() => ({ data: [] as ProductOption[] })),
    ])
      .then(([opsRes, deptRes, prodRes]) => {
        setRows(opsRes.data);
        setDepartments(deptRes.data);
        setProducts(prodRes.data);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const deptName = (id: number) =>
    departments.find((d) => d.department_id === id)?.department_name ?? `Dept #${id}`;

  const productName = (id: number | null) =>
    id ? products.find((p) => p.id === id)?.product_name ?? `Product #${id}` : "—";

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
      product_id: row.product_id != null ? String(row.product_id) : "",
      quantity: String(row.quantity),
      amount: String(row.amount),
      date: row.date,
    });
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        showToast("Operation record updated.", "green");
      } else {
        // Create returns OperationRecordWithTransaction
        const { data } = await api.post("/env/operations", payload);
        setResultDialog(data);
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
    if (!confirm(`Delete operation #${row.id}?`)) return;
    try {
      await api.delete(`/env/operations/${row.id}`);
      showToast("Operation record deleted.", "green");
      load();
    } catch (err) {
      showToast(errorMessage(err), "red");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Operation Records</h1>
          <p className="text-sm text-stone-500">
            Track purchases, manufacturing runs, expenses, and fleet trips. Auto-generates carbon
            transactions when enabled.
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Operation</Button>
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
          title="No operation records yet"
          description="Record your first operation to start tracking emissions from business activities."
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
                <Chip
                  tone={
                    r.op_type === "purchase"
                      ? "green"
                      : r.op_type === "fleet"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {r.op_type}
                </Chip>
              ),
            },
            {
              key: "department_id",
              label: "Department",
              render: (r) => <>{deptName(r.department_id)}</>,
            },
            {
              key: "product_id",
              label: "Product",
              render: (r) => <>{productName(r.product_id)}</>,
            },
            {
              key: "quantity",
              label: "Quantity",
              render: (r) => <span className="tabular-nums">{r.quantity}</span>,
            },
            {
              key: "amount",
              label: "Amount",
              render: (r) => <span className="tabular-nums">{r.amount}</span>,
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
          empty="No operation records yet."
        />
      )}

      {/* Create / Edit dialog */}
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
              onChange={(e) => setForm({ ...form, op_type: e.target.value as SourceType })}
              className="w-full"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
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
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.department_name}
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
                placeholder="e.g. 500"
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
                placeholder="e.g. 1200.00"
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

      {/* Result dialog — shows auto-generated carbon transaction */}
      <Dialog
        open={resultDialog !== null}
        onClose={() => setResultDialog(null)}
        title="Operation Created"
      >
        {resultDialog && (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-sm font-medium text-emerald-800">
                ✓ Operation #{resultDialog.operation.id} recorded successfully
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                {resultDialog.operation.op_type} · Qty {resultDialog.operation.quantity} · Amount{" "}
                {resultDialog.operation.amount}
              </p>
            </div>

            {resultDialog.carbon_transaction ? (
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-3">
                <p className="text-sm font-medium text-sky-800">
                  ⚡ Auto-generated Carbon Transaction
                </p>
                <p className="text-xs text-sky-600 mt-1">
                  CO₂e:{" "}
                  <span className="font-bold">
                    {(resultDialog.carbon_transaction.co2e_amount as number)?.toFixed(2)} kg
                  </span>{" "}
                  · Factor #{String(resultDialog.carbon_transaction.emission_factor_id)}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-stone-50 border border-stone-200 p-3">
                <p className="text-sm text-stone-500">
                  No carbon transaction was auto-generated (auto-calc may be disabled).
                </p>
              </div>
            )}

            {resultDialog.warning && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-700">⚠ {resultDialog.warning}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setResultDialog(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
