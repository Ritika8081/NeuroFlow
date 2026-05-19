"use client";

import React from "react";
import { Recommendation } from "../lib/recommendations";

interface Props {
  recommendations: Recommendation[];
  onApply: (rec: Recommendation) => void;
  onExcludeChannels?: (channels: string[]) => void;
}

const SEVERITY_CHIP: Record<string, string> = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  info: "bg-[rgb(var(--accent-bg))] text-[rgb(var(--accent-fg))] border-[rgb(var(--accent))]/30",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

const SEVERITY_LABEL: Record<string, string> = {
  good: "ok",
  info: "info",
  warn: "warn",
  danger: "alert",
};

export default function RecommendationsPanel({ recommendations, onApply }: Props) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="eyebrow">Recommendations</h3>
        <div className="text-xs text-[rgb(var(--muted))]">{recommendations.length} suggestion(s)</div>
      </div>
      <div className="space-y-2">
        {recommendations.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border bg-[rgb(var(--surface))] p-4 animate-fade-up"
          >
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 mt-0.5 inline-flex items-center text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${SEVERITY_CHIP[r.severity]}`}
              >
                {SEVERITY_LABEL[r.severity]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-xs text-[rgb(var(--muted))] mt-1 leading-relaxed">{r.body}</div>
                {r.apply && (
                  <div className="mt-2.5">
                    <button onClick={() => onApply(r)} className="btn btn-secondary text-xs">
                      {r.applyLabel ?? "Apply"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
