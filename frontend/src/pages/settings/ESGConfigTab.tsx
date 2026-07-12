import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { Button, Slider, Toast } from "../../components/ui";

interface Settings {
  id: number;
  auto_emission_calc: boolean;
  evidence_required: boolean;
  badge_auto_award: boolean;
  weight_env: number;
  weight_social: number;
  weight_gov: number;
  notify_email: boolean;
  notify_inapp: boolean;
}

export default function ESGConfigTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);

  useEffect(() => {
    api.get<Settings>("/settings")
      .then((r) => setSettings(r.data))
      .catch((e) => setToast({ message: errorMessage(e), tone: "red" }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const { data } = await api.put<Settings>("/settings", {
        auto_emission_calc: settings.auto_emission_calc,
        evidence_required: settings.evidence_required,
        badge_auto_award: settings.badge_auto_award,
        weight_env: settings.weight_env,
        weight_social: settings.weight_social,
        weight_gov: settings.weight_gov,
      });
      setSettings(data);
      setToast({ message: "ESG configuration saved.", tone: "green" });
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
        Loading settings…
      </div>
    );
  }

  if (!settings) return null;

  const weightSum = settings.weight_env + settings.weight_social + settings.weight_gov;

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500">
        Configure automation toggles and ESG scoring weights.
      </p>

      {/* Toggle switches */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-stone-700">Automation Toggles</h3>

        <ToggleRow
          label="Enable auto emission calculation"
          description="Automatically compute CO₂e from quantity × emission factor when logging carbon transactions."
          checked={settings.auto_emission_calc}
          onChange={(v) => setSettings({ ...settings, auto_emission_calc: v })}
        />
        <ToggleRow
          label="Require evidence for all CSR activities"
          description="Employees must upload proof files before participation can be approved."
          checked={settings.evidence_required}
          onChange={(v) => setSettings({ ...settings, evidence_required: v })}
        />
        <ToggleRow
          label="Auto-award badges on challenge completion"
          description="Automatically unlock the associated badge when a challenge is completed."
          checked={settings.badge_auto_award}
          onChange={(v) => setSettings({ ...settings, badge_auto_award: v })}
        />
      </div>

      {/* Scoring weights */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Scoring Weights</h3>
          <span
            className={`text-xs font-medium ${
              weightSum === 100
                ? "text-emerald-600"
                : "text-red-600"
            }`}
          >
            Sum: {weightSum}%{weightSum !== 100 && " ⚠ must equal 100"}
          </span>
        </div>

        <Slider
          label="Environmental"
          value={settings.weight_env}
          onChange={(v) => setSettings({ ...settings, weight_env: v })}
        />
        <Slider
          label="Social"
          value={settings.weight_social}
          onChange={(v) => setSettings({ ...settings, weight_social: v })}
        />
        <Slider
          label="Governance"
          value={settings.weight_gov}
          onChange={(v) => setSettings({ ...settings, weight_gov: v })}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || weightSum !== 100}>
          {saving ? "Saving…" : "Save ESG Configuration"}
        </Button>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />}
    </div>
  );
}

/* ── inline toggle row ──────────────────────────────────────────────── */

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-stone-700">{label}</div>
        <div className="text-xs text-stone-400">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-emerald-600" : "bg-stone-300"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
