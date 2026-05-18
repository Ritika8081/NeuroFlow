"use client";

import React, { useRef, useState } from "react";
import {
  analyzeFileForCohort,
  CohortSubject,
  rankAnomalies,
} from "../lib/cohort";
import { Spinner } from "./ui";

interface Props {
  onOpenSubject?: (s: CohortSubject) => void;
}

export default function CohortView({ onOpenSubject }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subjects, setSubjects] = useState<CohortSubject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"anomaly" | "quality" | "name">("anomaly");
  const [sampleRate, setSampleRate] = useState(250);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const next: CohortSubject[] = [...subjects];
    for (const file of Array.from(files)) {
      if (!/\.(csv|tsv|txt|json)$/i.test(file.name)) {
        setError(`Skipped ${file.name} — only CSV/TSV/JSON/TXT supported in batch (avoids backend).`);
        continue;
      }
      try {
        const subject = await analyzeFileForCohort(file, sampleRate);
        next.push(subject);
      } catch (e: any) {
        setError(`Failed to parse ${file.name}: ${e?.message ?? "unknown"}`);
      }
    }
    setSubjects(next);
    setBusy(false);
  };

  const sorted = (() => {
    const ranked = rankAnomalies(subjects);
    const list = [...ranked.subjects];
    if (sortKey === "quality") list.sort((a, b) => a.analysis.quality.overall - b.analysis.quality.overall);
    else if (sortKey === "name") list.sort((a, b) => a.fileName.localeCompare(b.fileName));
    return { list, medians: ranked.medians };
  })();

  const clearAll = () => {
    setSubjects([]);
    setError(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Batch QC</div>
        <h3 className="font-medium mt-1">Cohort dashboard</h3>
        <p className="text-sm text-[rgb(var(--muted))] mt-1 max-w-2xl">
          Drop multiple text recordings (CSV / TSV / JSON / TXT) for batch analysis. Each subject
          is scored and ranked by anomaly relative to the cohort median — the most unusual subjects
          float to the top for triage.
        </p>
      </div>

      {/* Upload zone */}
      <div className="surface rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] text-[rgb(var(--muted))] block mb-1.5">Sampling rate</label>
          <input
            type="number"
            value={sampleRate}
            onChange={(e) => setSampleRate(Number(e.target.value) || 250)}
            min={1}
            max={10000}
            className="input mono w-32"
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.json"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn btn-primary text-sm"
        >
          {busy ? <><Spinner /> Analyzing…</> : "Add recordings"}
        </button>
        {subjects.length > 0 && (
          <button onClick={clearAll} className="btn btn-ghost text-xs ml-auto">
            Clear ({subjects.length})
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="surface rounded-xl p-8 text-sm text-[rgb(var(--muted))] text-center">
          No subjects loaded. Drop one or more text recordings above to get started.
        </div>
      ) : (
        <>
          {/* Cohort medians */}
          <div className="grid sm:grid-cols-4 gap-3">
            <SummaryStat label="Subjects" value={`${subjects.length}`} />
            <SummaryStat label="Median quality" value={`${sorted.medians.quality.toFixed(0)}/100`} />
            <SummaryStat
              label="Median alpha peak"
              value={sorted.medians.alphaPeakHz ? `${sorted.medians.alphaPeakHz.toFixed(1)} Hz` : "—"}
            />
            <SummaryStat
              label="Median bad channels"
              value={`${sorted.medians.badChannelCount}`}
            />
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[rgb(var(--muted))]">Sort by:</span>
            {(["anomaly", "quality", "name"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`px-2.5 py-1 rounded-md border ${
                  sortKey === k
                    ? "bg-[rgb(var(--accent-bg))] text-[rgb(var(--accent-fg))] border-[rgb(var(--accent))]/40"
                    : "text-[rgb(var(--muted))] border-[rgb(var(--border))]"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Subject grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.list.map((s) => (
              <SubjectCard key={s.id} subject={s} onOpen={onOpenSubject} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-xl p-3">
      <div className="eyebrow">{label}</div>
      <div className="text-xl font-medium mono mt-1">{value}</div>
    </div>
  );
}

function SubjectCard({
  subject,
  onOpen,
}: {
  subject: CohortSubject;
  onOpen?: (s: CohortSubject) => void;
}) {
  const q = subject.analysis.quality.overall;
  const qColor =
    q >= 80 ? "text-emerald-600 dark:text-emerald-400"
    : q >= 60 ? "text-amber-600 dark:text-amber-400"
    : "text-rose-600 dark:text-rose-400";
  return (
    <button
      onClick={() => onOpen?.(subject)}
      className="surface rounded-xl p-4 text-left hover-lift"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{subject.fileName}</div>
          <div className="text-[11px] text-[rgb(var(--muted))] mono">
            {subject.channels} ch · {subject.sampleRate} Hz · {subject.duration.toFixed(1)}s
          </div>
        </div>
        <span className={`mono text-sm ${qColor}`}>{q}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <span className="text-[rgb(var(--muted))]">State:</span>{" "}
          <span className="capitalize">{subject.analysis.cognitive.state}</span>
        </div>
        <div>
          <span className="text-[rgb(var(--muted))]">Dominant:</span>{" "}
          <span className="capitalize">{subject.analysis.dominantBand}</span>
        </div>
        <div>
          <span className="text-[rgb(var(--muted))]">α peak:</span>{" "}
          <span className="mono">
            {subject.analysis.alphaPeakHz ? subject.analysis.alphaPeakHz.toFixed(1) + " Hz" : "—"}
          </span>
        </div>
        <div>
          <span className="text-[rgb(var(--muted))]">Bad ch:</span>{" "}
          <span className="mono">{subject.analysis.quality.badChannels.length}</span>
        </div>
      </div>
      {subject.anomalyScore > 0 && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-[10px] text-[rgb(var(--muted))]">anomaly</span>
          <span className="mono text-[11px]">{subject.anomalyScore.toFixed(2)}σ</span>
        </div>
      )}
    </button>
  );
}
