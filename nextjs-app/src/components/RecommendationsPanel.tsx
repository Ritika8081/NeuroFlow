"use client";

import React from "react";
import { Recommendation } from "../lib/recommendations";

interface Props {
  recommendations: Recommendation[];
  onApply: (rec: Recommendation) => void;
  onExcludeChannels?: (channels: string[]) => void;
}

const SEVERITY: Record<string, { dot: string; border: string }> = {
  good: { dot: "bg-emerald-500", border: "border-l-emerald-500" },
  info: { dot: "bg-[rgb(var(--accent))]", border: "border-l-[rgb(var(--accent))]" },
  warn: { dot: "bg-amber-500", border: "border-l-amber-500" },
  danger: { dot: "bg-red-500", border: "border-l-red-500" },
};

export default function RecommendationsPanel({ recommendations, onApply }: Props) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Recommendations</div>
        <div className="text-xs text-[rgb(var(--muted))]">{recommendations.length} suggestion(s)</div>
      </div>
      <div className="space-y-2">
        {recommendations.map((r) => {
          const s = SEVERITY[r.severity];
          return (
            <div
              key={r.id}
              className={`rounded-lg border border-l-4 ${s.border} bg-[rgb(var(--surface))] p-4 animate-fade-up`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${s.dot} shrink-0`} />
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
          );
        })}
      </div>
    </div>
  );
}
