// ponytail: hand-rolled shadcn-style primitives — zero extra deps.
// Swap for real shadcn/ui components if the team standardizes on the CLI.
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";

export function Button({ className = "", variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800",
    outline: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-stone-600 hover:bg-stone-100",
  }[variant];
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" }) {
  const styles = {
    neutral: "bg-stone-100 text-stone-600",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

/* ── Dialog / Modal ────────────────────────────────────────────────────── */

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl animate-[fadeIn_150ms_ease-out]"
      >
        <h3 className="text-lg font-semibold text-stone-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ── Toast ─────────────────────────────────────────────────────────────── */

export function Toast({
  message,
  tone = "neutral",
  onDismiss,
}: {
  message: string;
  tone?: "neutral" | "green" | "red";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg = {
    neutral: "bg-stone-800",
    green: "bg-emerald-700",
    red: "bg-red-600",
  }[tone];

  return createPortal(
    <div
      className={`fixed bottom-5 right-5 z-[60] max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg ${bg} animate-[slideUp_200ms_ease-out]`}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button onClick={onDismiss} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
      </div>
    </div>,
    document.body,
  );
}

/* ── Slider ────────────────────────────────────────────────────────────── */

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-stone-500">
          <span>{label}</span>
          <span className="font-medium text-stone-700">{value}%</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
    </div>
  );
}
