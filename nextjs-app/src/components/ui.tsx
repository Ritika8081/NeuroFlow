"use client";

import React from "react";

export function Card({
  children,
  className = "",
  as: As = "div",
  lume = false, // kept for API compat; ignored
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  lume?: boolean;
}) {
  return (
    <As className={`surface rounded-xl p-5 sm:p-6 ${className}`}>{children}</As>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-[rgb(var(--muted))] mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "cyan" | "indigo" | "violet" | "pink" | "emerald" | "amber";
}) {
  return (
    <div className="surface hover-lift rounded-xl p-4 sm:p-5 group">
      <div className="eyebrow group-hover:text-[rgb(var(--text-soft))] transition-colors">{label}</div>
      <div className="text-2xl sm:text-3xl font-medium tracking-[-0.02em] mt-2 truncate">{value}</div>
      {hint && <div className="text-xs text-[rgb(var(--muted))] mt-1.5">{hint}</div>}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Banner({
  tone = "info",
  children,
  onClose,
}: {
  tone?: "info" | "success" | "danger" | "warning";
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const tones: Record<string, string> = {
    info: "text-[rgb(var(--text))] bg-[rgb(var(--surface-2))] border",
    success: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
    danger: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30",
    warning: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
  };
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function FilterField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  unit = "Hz",
}: {
  label: string;
  value: number | null | "";
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  accent?: "indigo" | "violet" | "pink" | "emerald" | "amber" | "cyan";
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] text-[rgb(var(--muted))]">{label}</label>
        <span className="text-[10px] mono text-[rgb(var(--subtle))]">{unit}</span>
      </div>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step ?? 0.1}
        value={value ?? ""}
        placeholder={placeholder ?? "—"}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="input mono"
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  highlight?: "violet" | "cyan";
}) {
  return (
    <div className="inline-flex rounded-md border bg-[rgb(var(--surface))]">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1.5 text-xs transition first:rounded-l-md last:rounded-r-md ${
            value === opt.id
              ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--text))]"
              : "text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
