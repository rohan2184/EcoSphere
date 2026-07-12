import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { Button, Toast } from "../../components/ui";

interface Settings {
  id: number;
  notify_email: boolean;
  notify_inapp: boolean;
  // other fields exist but we only touch notification toggles here
  [key: string]: unknown;
}

const PER_EVENT_ROWS = [
  { label: "Compliance issue overdue", description: "When a compliance issue passes its due date" },
  { label: "Policy approval required", description: "When a new policy requires acknowledgement" },
  { label: "Acknowledgement reminders", description: "Periodic reminders for unacknowledged policies" },
  { label: "Badge unlocked", description: "When an employee earns a new badge" },
  { label: "Challenge completed", description: "When a gamification challenge is completed" },
];

export default function NotificationSettingsTab() {
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
        notify_email: settings.notify_email,
        notify_inapp: settings.notify_inapp,
      });
      setSettings(data);
      setToast({ message: "Notification settings saved.", tone: "green" });
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "red" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-stone-400 shadow-sm">
        Loading notification settings…
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-500">
        Control how you receive alerts and notifications.
      </p>

      {/* Global toggles */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-stone-700">Global Alert Channels</h3>

        <ToggleRow
          label="Email alerts"
          description="Receive notification emails for important events."
          checked={settings.notify_email}
          onChange={(v) => setSettings({ ...settings, notify_email: v })}
        />
        <ToggleRow
          label="In-app alerts"
          description="Show notification badges and bell alerts within the application."
          checked={settings.notify_inapp}
          onChange={(v) => setSettings({ ...settings, notify_inapp: v })}
        />
      </div>

      {/* Per-event matrix (disabled — coming soon) */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Per-Event Preferences</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Coming soon
          </span>
        </div>
        <p className="text-xs text-stone-400">
          Fine-grained control over which events trigger notifications. This feature requires additional backend support.
        </p>
        <div className="space-y-3 opacity-50 pointer-events-none select-none">
          {PER_EVENT_ROWS.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-stone-700">{row.label}</div>
                <div className="text-xs text-stone-400">{row.description}</div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-xs text-stone-500">
                  <input type="checkbox" disabled className="accent-emerald-600" /> Email
                </label>
                <label className="flex items-center gap-1 text-xs text-stone-500">
                  <input type="checkbox" disabled className="accent-emerald-600" /> In-app
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Notification Settings"}
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
