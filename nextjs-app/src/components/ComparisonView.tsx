"use client";

import React, { useMemo, useState } from "react";
import { AnalysisBundle, runAnalysis } from "../lib/insights";
import { BAND_COLORS, BAND_ORDER } from "../lib/dsp";
import { SampleRecording, SAMPLES } from "../lib/sample-data";

interface RecordingShape {
  filename: string;
  channels: number;
  channel_names: string[];
  sampling_rate: number;
  duration_sec: number;
  data?: number[][];
  preview?: number[][];
  cleaned_data?: number[][];
}

interface Props {
  primary: RecordingShape;
  primaryAnalysis: AnalysisBundle;
}

export default function ComparisonView({ primary, primaryAnalysis }: Props) {
  const [b, setB] = useState<RecordingShape | null>(null);

  const bAnalysis: AnalysisBundle | null = useMemo(() => {
    if (!b) return null;
    const data = b.cleaned_data ?? b.preview ?? b.data ?? [];
    if (!data.length) return null;
    try {
      return runAnalysis(data, b.channel_names, b.sampling_rate);
    } catch {
      return null;
    }
  }, [b]);

  const loadSample = (rec: SampleRecording) => setB(rec);

  if (!b || !bAnalysis) {
    return (
      <div className="space-y-5">
        <div>
          <div className="eyebrow">Compare</div>
          <h3 className="font-medium mt-1">Pick a second recording</h3>
          <p className="text-sm text-[rgb(var(--muted))] mt-1">
            Useful for pre/post studies, condition contrasts, or sanity-checking a clean.
          </p>
        </div>
        <div className="surface rounded-xl p-4">
          <div className="eyebrow mb-2">Choose a synthetic sample</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSample(s.build())}
                className="text-left rounded-md border bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--surface))] hover:border-[rgb(var(--accent))] p-3 transition"
              >
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-[rgb(var(--muted))] mt-0.5 line-clamp-1">
                  {s.build().description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const aTotal = primaryAnalysis.avgBands.total || 1;
  const bTotal = bAnalysis.avgBands.total || 1;
  const qDelta = bAnalysis.quality.overall - primaryAnalysis.quality.overall;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Comparison</div>
          <h3 className="font-medium mt-1">
            <span className="text-[rgb(var(--accent-soft))]">A</span> vs <span className="text-amber-500">B</span>
          </h3>
        </div>
        <button onClick={() => setB(null)} className="btn btn-ghost text-xs">Change B</button>
      </div>

      {/* Headers */}
      <div className="grid sm:grid-cols-2 gap-3">
        <RecordingHeader label="A" color="text-[rgb(var(--accent-soft))]" rec={primary} analysis={primaryAnalysis} />
        <RecordingHeader label="B" color="text-amber-500" rec={b} analysis={bAnalysis} />
      </div>

      {/* Delta strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Delta label="Quality" a={primaryAnalysis.quality.overall} b={bAnalysis.quality.overall} suffix="/100" />
        <Delta
          label="Alpha peak (Hz)"
          a={primaryAnalysis.alphaPeakHz ?? NaN}
          b={bAnalysis.alphaPeakHz ?? NaN}
          precision={2}
        />
        <Delta
          label="State"
          aText={primaryAnalysis.cognitive.state}
          bText={bAnalysis.cognitive.state}
        />
        <Delta
          label="Bad channels"
          a={primaryAnalysis.quality.badChannels.length}
          b={bAnalysis.quality.badChannels.length}
        />
      </div>

      {/* Band power comparison */}
      <div className="surface rounded-xl p-5">
        <div className="eyebrow mb-3">Band composition</div>
        <div className="space-y-3">
          {BAND_ORDER.map((band) => {
            const av = (primaryAnalysis.avgBands[band] / aTotal) * 100;
            const bv = (bAnalysis.avgBands[band] / bTotal) * 100;
            const max = Math.max(av, bv, 1);
            return (
              <div key={band} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="capitalize text-[rgb(var(--muted))]">{band}</span>
                  <span className="mono">
                    A {av.toFixed(0)}% · B {bv.toFixed(0)}%
                  </span>
                </div>
                <div className="flex h-2 gap-1">
                  <div className="flex-1 bg-[rgb(var(--surface-2))] rounded">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(av / max) * 100}%`, background: BAND_COLORS[band] }}
                    />
                  </div>
                  <div className="flex-1 bg-[rgb(var(--surface-2))] rounded">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(bv / max) * 100}%`, background: BAND_COLORS[band] }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick verbal summary */}
      <div className="surface rounded-xl p-5">
        <div className="eyebrow mb-2">Summary</div>
        <ul className="text-sm space-y-1 text-[rgb(var(--text-soft))]">
          <li>
            • Quality {qDelta > 0 ? "improved" : qDelta < 0 ? "decreased" : "unchanged"} by{" "}
            <span className="mono">{Math.abs(qDelta)}</span> points in B.
          </li>
          <li>
            • A is <span className="capitalize">{primaryAnalysis.cognitive.state}</span>; B is{" "}
            <span className="capitalize">{bAnalysis.cognitive.state}</span>.
          </li>
          <li>
            • Dominant: A <span className="capitalize">{primaryAnalysis.dominantBand}</span>, B{" "}
            <span className="capitalize">{bAnalysis.dominantBand}</span>.
          </li>
        </ul>
      </div>
    </div>
  );
}

function RecordingHeader({
  label,
  color,
  rec,
  analysis,
}: {
  label: string;
  color: string;
  rec: RecordingShape;
  analysis: AnalysisBundle;
}) {
  return (
    <div className="surface rounded-xl p-4">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${color}`}>● {label}</span>
        <span className="text-sm font-medium truncate">{rec.filename}</span>
      </div>
      <div className="mt-1 text-xs text-[rgb(var(--muted))] mono">
        {rec.channels} ch · {rec.sampling_rate} Hz · {rec.duration_sec.toFixed(1)}s
      </div>
      <div className="mt-2 text-xs text-[rgb(var(--muted))]">
        <span className="capitalize">{analysis.cognitive.state}</span> ·{" "}
        <span className="mono">{analysis.quality.overall}/100</span>
      </div>
    </div>
  );
}

function Delta({
  label,
  a,
  b,
  aText,
  bText,
  precision = 0,
  suffix = "",
}: {
  label: string;
  a?: number;
  b?: number;
  aText?: string;
  bText?: string;
  precision?: number;
  suffix?: string;
}) {
  return (
    <div className="surface rounded-xl p-3">
      <div className="eyebrow">{label}</div>
      {aText !== undefined || bText !== undefined ? (
        <div className="text-sm mt-1">
          <span className="text-[rgb(var(--accent-soft))] capitalize">{aText}</span>
          <span className="text-[rgb(var(--muted))]"> → </span>
          <span className="text-amber-500 capitalize">{bText}</span>
        </div>
      ) : (
        <div className="text-sm mt-1 mono">
          <span className="text-[rgb(var(--accent-soft))]">
            {Number.isFinite(a as number) ? (a as number).toFixed(precision) + suffix : "—"}
          </span>
          <span className="text-[rgb(var(--muted))]"> → </span>
          <span className="text-amber-500">
            {Number.isFinite(b as number) ? (b as number).toFixed(precision) + suffix : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
