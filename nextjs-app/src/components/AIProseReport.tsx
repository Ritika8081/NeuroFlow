"use client";

import React, { useState } from "react";
import { useAI } from "./AIProvider";
import { callLLM, LLMError } from "../lib/ai-client";
import { PROSE_REPORT_SYSTEM, RecordingSummary, recordingContextBlock } from "../lib/ai-prompts";
import { Spinner } from "./ui";

interface Props {
  summary: RecordingSummary;
  onOpenSettings: () => void;
}

export default function AIProseReport({ summary, onOpenSettings }: Props) {
  const { config, active } = useAI();
  const isLocal = config.activeProvider === "local";
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await callLLM(config, {
        system: PROSE_REPORT_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Write the report from the following:\n\n${recordingContextBlock(summary)}`,
          },
        ],
        temperature: 0.5,
        maxTokens: 1500,
      });
      setText(result.text);
    } catch (e: any) {
      setError(e instanceof LLMError ? e.message : e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stripExt(summary.fileName)}.narrative.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="eyebrow">
            AI-written
          </div>
          <h3 className="font-semibold">Narrative report</h3>
          <div className="text-xs text-[rgb(var(--muted))] mt-1">
            Prose summary written by your configured LLM, grounded in this recording's metrics.
          </div>
        </div>
        {isLocal ? (
          <button onClick={onOpenSettings} className="btn btn-secondary text-xs">
            Set up AI provider →
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[rgb(var(--muted))] hidden sm:inline">
              {active.label}
            </span>
            <button onClick={generate} disabled={busy} className="btn btn-primary text-sm">
              {busy ? (
                <>
                  <Spinner /> writing…
                </>
              ) : text ? (
                <>Regenerate</>
              ) : (
                <>Generate</>
              )}
            </button>
          </div>
        )}
      </div>

      {isLocal && !text && (
        <div className="text-sm text-[rgb(var(--muted))] rounded-lg border bg-[rgb(var(--surface-2))] p-4 text-center">
          A real LLM is required to write the narrative report. The local fallback only gives
          structured findings — head to{" "}
          <button onClick={onOpenSettings} className="underline text-[rgb(var(--accent-fg))]">
            AI settings
          </button>{" "}
          and pick a free provider (Groq, Gemini, OpenRouter).
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {text && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-[rgb(var(--surface-2))] p-5 prose-eeg whitespace-pre-wrap text-sm leading-relaxed max-h-[520px] overflow-auto">
            {text}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="btn btn-secondary text-xs">
              {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={download} className="btn btn-secondary text-xs">
              Download .md
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function stripExt(s: string) {
  return s.replace(/\.[^.]+$/, "");
}
