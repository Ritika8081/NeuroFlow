"use client";

import React, { useState } from "react";
import { autoClean, AutoCleanInput, AutoCleanRecipe } from "../lib/autoclean";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
  useCase?: AutoCleanInput["useCase"];
  onApply: (recipe: AutoCleanRecipe) => void;
}

export default function AutoCleanPanel({ data, channelNames, sampleRate, useCase, onApply }: Props) {
  const [recipe, setRecipe] = useState<AutoCleanRecipe | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    // Defer so the button shows the busy state instantly
    setTimeout(() => {
      const r = autoClean({ data, channelNames, sampleRate, useCase });
      setRecipe(r);
      setBusy(false);
    }, 30);
  };

  return (
    <div className="surface rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Automation</div>
          <h3 className="font-medium mt-1">One-click auto-clean</h3>
          <p className="text-sm text-[rgb(var(--muted))] mt-1 max-w-md">
            Inspects mains noise, channel health, and your paradigm, then proposes a complete filter chain
            and a bad-channel list. Review before applying.
          </p>
        </div>
        {!recipe ? (
          <button onClick={run} disabled={busy} className="btn btn-primary text-sm">
            {busy ? "Analyzing…" : "Run auto-clean"}
          </button>
        ) : (
          <button onClick={() => setRecipe(null)} className="btn btn-ghost text-xs">
            Reset
          </button>
        )}
      </div>

      {recipe && (
        <div className="mt-5 space-y-4 animate-fade-up">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              ["BP low", `${recipe.bandpass_low} Hz`],
              ["BP high", `${recipe.bandpass_high} Hz`],
              ["Notch", `${recipe.notch_freq} Hz`],
              ["HP", recipe.highpass_freq != null ? `${recipe.highpass_freq} Hz` : "—"],
              ["LP", recipe.lowpass_freq != null ? `${recipe.lowpass_freq} Hz` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border bg-[rgb(var(--surface-2))] p-2.5">
                <div className="text-[10px] text-[rgb(var(--muted))]">{k}</div>
                <div className="mono text-sm mt-0.5">{v}</div>
              </div>
            ))}
          </div>

          {recipe.exclude_channels.length > 0 && (
            <div>
              <div className="eyebrow mb-1.5">Channels to exclude</div>
              <div className="flex flex-wrap gap-1.5">
                {recipe.exclude_channels.map((c) => (
                  <span
                    key={c}
                    className="chip border-red-500/40 text-red-600 dark:text-red-300 bg-red-500/5"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="eyebrow mb-1.5">Rationale</div>
            <ul className="space-y-1.5 text-sm">
              {recipe.rationale.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-[rgb(var(--muted))] shrink-0" />
                  <span>
                    <span className="font-medium">{r.step}.</span>{" "}
                    <span className="text-[rgb(var(--muted))]">{r.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {recipe.expectedImprovements.length > 0 && (
            <div>
              <div className="eyebrow mb-1.5">Expected improvements</div>
              <ul className="text-sm text-[rgb(var(--text-soft))] space-y-1">
                {recipe.expectedImprovements.map((m) => (
                  <li key={m} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <button onClick={() => onApply(recipe)} className="btn btn-primary text-sm">
              Apply recipe
            </button>
            <button onClick={() => setRecipe(null)} className="btn btn-ghost text-xs">
              Discard
            </button>
            <span className="text-xs text-[rgb(var(--muted))] ml-auto">
              Quality before: <span className="mono">{recipe.qualityBefore}/100</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
