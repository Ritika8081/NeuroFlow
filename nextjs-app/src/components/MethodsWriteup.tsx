"use client";

import React, { useState } from "react";
import { useAI } from "./AIProvider";
import { callLLM, LLMError } from "../lib/ai-client";
import { Spinner } from "./ui";
import { AnalysisBundle } from "../lib/insights";

interface Props {
  fileName: string;
  channels: number;
  channelNames: string[];
  sampleRate: number;
  duration: number;
  filters: {
    bandpass_low: number;
    bandpass_high: number;
    notch_freq: number;
    highpass_freq: number | null;
    lowpass_freq: number | null;
  };
  analysis: AnalysisBundle;
  onOpenSettings: () => void;
}

const SYSTEM = `You are a senior author writing the "EEG acquisition and pre-processing" subsection
of a Methods section for a peer-reviewed journal. Style: concise, passive scientific voice,
no first-person, no marketing language. Include:
- The recording's montage / channel count and sampling rate.
- Each filter cut-off and its frequency band.
- The notch / line-noise frequency.
- Any artifact-rejection decisions (bad channels excluded).
- Software/version: "Pre-processing was performed in NeuroFlow Lab (v0.2)."
- One paragraph for acquisition, one for pre-processing.

Constraints: 120-200 words total. Markdown. No tables.`;

export default function MethodsWriteup({
  fileName,
  channels,
  channelNames,
  sampleRate,
  duration,
  filters,
  analysis,
  onOpenSettings,
}: Props) {
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
      const context = [
        `File: ${fileName}`,
        `Channels (${channels}): ${channelNames.join(", ")}`,
        `Sampling rate: ${sampleRate} Hz`,
        `Recording duration: ${duration.toFixed(1)} seconds`,
        ``,
        `Filters applied:`,
        `- Band-pass: ${filters.bandpass_low}–${filters.bandpass_high} Hz`,
        `- Notch: ${filters.notch_freq} Hz`,
        ...(filters.highpass_freq != null ? [`- High-pass: ${filters.highpass_freq} Hz`] : []),
        ...(filters.lowpass_freq != null ? [`- Low-pass: ${filters.lowpass_freq} Hz`] : []),
        ``,
        `Quality score: ${analysis.quality.overall}/100`,
        analysis.quality.badChannels.length > 0
          ? `Bad channels excluded: ${analysis.quality.badChannels.join(", ")}`
          : "No channels excluded.",
      ].join("\n");
      const result = await callLLM(config, {
        system: SYSTEM,
        messages: [{ role: "user", content: context }],
        temperature: 0.3,
        maxTokens: 600,
      });
      setText(result.text);
    } catch (e: any) {
      setError(e instanceof LLMError ? e.message : e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
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
    <div className="surface rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Authoring</div>
          <h3 className="font-medium mt-1">Methods paragraph</h3>
          <p className="text-sm text-[rgb(var(--muted))] mt-1">
            Generates a journal-style "EEG acquisition and pre-processing" paragraph from your current
            filter chain and analysis state. Paste into your manuscript and verify.
          </p>
        </div>
        {isLocal ? (
          <button onClick={onOpenSettings} className="btn btn-secondary text-xs">
            Set up AI →
          </button>
        ) : (
          <button onClick={generate} disabled={busy} className="btn btn-primary text-sm">
            {busy ? <><Spinner /> writing…</> : text ? "Regenerate" : "Generate"}
          </button>
        )}
      </div>

      {!isLocal && <div className="text-[10px] text-[rgb(var(--muted))] mt-2">{active.label}</div>}

      {error && (
        <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
          {error}
        </div>
      )}

      {text && (
        <div className="mt-4 space-y-3 animate-fade-up">
          <div className="rounded-lg border bg-[rgb(var(--surface-2))] p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {text}
          </div>
          <button onClick={copy} className="btn btn-secondary text-xs">
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
      )}
    </div>
  );
}
