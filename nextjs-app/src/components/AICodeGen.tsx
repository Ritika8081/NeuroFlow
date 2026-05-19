"use client";

import React, { useState } from "react";
import { useAI } from "./AIProvider";
import { callLLM, LLMError } from "../lib/ai-client";
import { CODE_GEN_SYSTEM, RecordingSummary, recordingContextBlock } from "../lib/ai-prompts";
import { Spinner } from "./ui";

interface Props {
  summary: RecordingSummary;
  onOpenSettings: () => void;
}

type Target = "mne" | "eeglab" | "fieldtrip";

const TARGET_LABEL: Record<Target, string> = {
  mne: "MNE-Python",
  eeglab: "EEGLAB (MATLAB)",
  fieldtrip: "FieldTrip (MATLAB)",
};

export default function AICodeGen({ summary, onOpenSettings }: Props) {
  const { config, active } = useAI();
  const isLocal = config.activeProvider === "local";
  const [target, setTarget] = useState<Target>("mne");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await callLLM(config, {
        system:
          target === "mne"
            ? CODE_GEN_SYSTEM
            : `You are an expert generating reproducible EEG pre-processing scripts for ${TARGET_LABEL[target]}. Produce a single self-contained script that mirrors the NeuroFlow pipeline: band-pass, notch, optional high/low pass, bad-channel marking, PSD plot, and per-channel band power export. Code only — no markdown fences.`,
        messages: [
          {
            role: "user",
            content: `Target: ${TARGET_LABEL[target]}.\n\nContext:\n${recordingContextBlock(summary)}`,
          },
        ],
        temperature: 0.2,
        maxTokens: 1800,
      });
      setCode(stripFences(result.text));
    } catch (e: any) {
      setError(e instanceof LLMError ? e.message : e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!code) return;
    const ext = target === "mne" ? "py" : "m";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stripExt(summary.fileName)}.pipeline.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="eyebrow">
            Reproducibility
          </div>
          <h3 className="font-semibold">AI pipeline code generator</h3>
          <div className="text-xs text-[rgb(var(--muted))] mt-1">
            Export this exact NeuroFlow pipeline as runnable code for your favourite EEG framework.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5 bg-[rgb(var(--surface-2))]">
            {(["mne", "eeglab", "fieldtrip"] as Target[]).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={`px-2.5 py-1 text-xs rounded-md transition ${
                  target === t
                    ? "bg-[rgb(var(--accent))] text-white dark:text-[rgb(20,18,25)]"
                    : "text-[rgb(var(--muted))]"
                }`}
              >
                {TARGET_LABEL[t].split(" ")[0]}
              </button>
            ))}
          </div>
          {isLocal ? (
            <button onClick={onOpenSettings} className="btn btn-secondary text-xs">
              Set up AI →
            </button>
          ) : (
            <button onClick={generate} disabled={busy} className="btn btn-primary text-sm">
              {busy ? (
                <>
                  <Spinner /> generating…
                </>
              ) : code ? (
                "Regenerate"
              ) : (
                "Generate"
              )}
            </button>
          )}
        </div>
      </div>

      {!isLocal && (
        <div className="text-[10px] text-[rgb(var(--muted))] mb-2">{active.label}</div>
      )}

      {isLocal && !code && (
        <div className="text-sm text-[rgb(var(--muted))] rounded-lg border bg-[rgb(var(--surface-2))] p-4 text-center">
          Configure a free LLM provider (Groq is fastest) to enable code generation.
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {code && (
        <div className="space-y-3">
          <pre className="rounded-xl border bg-[rgb(var(--surface-3))] dark:bg-[rgb(var(--bg-deep))] p-4 text-[12px] mono leading-relaxed max-h-[520px] overflow-auto whitespace-pre">
            <code>{code}</code>
          </pre>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="btn btn-secondary text-xs">
              {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={download} className="btn btn-secondary text-xs">
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function stripFences(text: string): string {
  return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```\s*$/, "");
}
function stripExt(s: string) {
  return s.replace(/\.[^.]+$/, "");
}
