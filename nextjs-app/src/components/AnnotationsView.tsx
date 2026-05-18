"use client";

import React, { useMemo, useState } from "react";
import { ArtifactEvent, detectArtifacts } from "../lib/dsp";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
  duration: number;
}

const TYPE_STYLE: Record<ArtifactEvent["type"], { label: string; color: string; bg: string }> = {
  blink: { label: "Blink", color: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-500/15 border-cyan-500/30" },
  muscle: { label: "Muscle", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  "line-noise": { label: "Mains 50/60 Hz", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-500/15 border-rose-500/30" },
  amplitude: { label: "Spike", color: "text-fuchsia-700 dark:text-fuchsia-300", bg: "bg-fuchsia-500/15 border-fuchsia-500/30" },
  flat: { label: "Flat channel", color: "text-[rgb(var(--muted))]", bg: "bg-[rgb(var(--surface-3))] border-[rgb(var(--border))]" },
};

export default function AnnotationsView({ data, channelNames, sampleRate, duration }: Props) {
  const artifacts = useMemo(
    () => detectArtifacts(data, channelNames, sampleRate),
    [data, channelNames, sampleRate]
  );

  const [filter, setFilter] = useState<ArtifactEvent["type"] | "all">("all");
  const [userNotes, setUserNotes] = useState<{ time: number; note: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newTime, setNewTime] = useState("0");

  const filtered = filter === "all" ? artifacts : artifacts.filter((a) => a.type === filter);

  const typeCounts = artifacts.reduce(
    (acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<ArtifactEvent["type"], number>
  );

  return (
    <div className="space-y-5">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-md text-xs border ${
            filter === "all" ? "bg-[rgb(var(--surface-2))]" : "text-[rgb(var(--muted))]"
          }`}
        >
          All ({artifacts.length})
        </button>
        {(Object.keys(TYPE_STYLE) as ArtifactEvent["type"][]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-md text-xs border ${
              filter === t ? TYPE_STYLE[t].bg : "text-[rgb(var(--muted))]"
            }`}
          >
            {TYPE_STYLE[t].label} ({typeCounts[t] ?? 0})
          </button>
        ))}
      </div>

      {/* Timeline strip */}
      <div className="glass rounded-2xl p-5">
        <div className="eyebrow mb-3">
          Timeline · {duration.toFixed(1)}s
        </div>
        <div className="relative h-16 rounded-lg bg-[rgb(var(--surface-2))] border overflow-hidden">
          {/* Time ticks */}
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-[rgb(var(--border))]"
              style={{ left: `${i * 10}%` }}
            />
          ))}
          {/* Artifact markers */}
          {filtered.map((a, i) => {
            const x0 = (a.startSample / sampleRate / duration) * 100;
            const w = Math.max(0.4, ((a.endSample - a.startSample) / sampleRate / duration) * 100);
            const style = TYPE_STYLE[a.type];
            return (
              <div
                key={i}
                className={`absolute top-2 bottom-2 ${style.bg} border-l border-r`}
                style={{ left: `${x0}%`, width: `${w}%` }}
                title={`${style.label} on ${a.channelName} (${(a.startSample / sampleRate).toFixed(2)}-${(a.endSample / sampleRate).toFixed(2)}s)`}
              />
            );
          })}
          {/* User notes */}
          {userNotes.map((n, i) => {
            const x = (n.time / duration) * 100;
            return (
              <div
                key={`note-${i}`}
                className="absolute top-0 bottom-0 w-0.5 bg-emerald-400"
                style={{ left: `${x}%` }}
                title={n.note}
              >
                <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-emerald-400" />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-[rgb(var(--muted))] mt-1">
          <span>0s</span>
          <span>{duration.toFixed(1)}s</span>
        </div>
      </div>

      {/* User annotations */}
      <div className="glass rounded-2xl p-5">
        <div className="eyebrow mb-3">
          Your annotations
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] text-[rgb(var(--muted))]">Time (s)</label>
            <input
              type="number"
              min={0}
              max={duration}
              step={0.1}
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div className="flex-[3] min-w-[180px]">
            <label className="text-[11px] text-[rgb(var(--muted))]">Note</label>
            <input
              type="text"
              placeholder="e.g. 'subject opened eyes'"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="input mt-1"
            />
          </div>
          <button
            disabled={!newNote.trim()}
            onClick={() => {
              setUserNotes((p) => [...p, { time: Number(newTime), note: newNote.trim() }].sort((a, b) => a.time - b.time));
              setNewNote("");
            }}
            className="btn btn-primary text-sm"
          >
            Add
          </button>
        </div>
        {userNotes.length > 0 && (
          <div className="mt-3 divide-y border rounded-lg bg-[rgb(var(--surface-2))]">
            {userNotes.map((n, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[rgb(var(--muted))]">{n.time.toFixed(1)}s</span>
                  <span>{n.note}</span>
                </div>
                <button
                  onClick={() => setUserNotes((p) => p.filter((_, j) => j !== i))}
                  className="text-[rgb(var(--muted))] hover:text-rose-400 text-xs"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-detected list */}
      <div className="glass rounded-2xl p-5">
        <div className="eyebrow mb-3">
          AI-detected events · {filtered.length} shown
        </div>
        <div className="max-h-[360px] overflow-auto border rounded-lg divide-y bg-[rgb(var(--surface))]">
          {filtered.length === 0 && (
            <div className="text-sm text-[rgb(var(--muted))] p-4 text-center">No events matching this filter.</div>
          )}
          {filtered.map((a, i) => {
            const style = TYPE_STYLE[a.type];
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className={`text-[10px] px-2 py-0.5 rounded ${style.bg} ${style.color} border font-medium`}>
                  {style.label}
                </span>
                <span className="font-mono text-[11px] text-[rgb(var(--muted))] w-12">{a.channelName}</span>
                <span className="font-mono text-[11px] text-[rgb(var(--muted))]">
                  {(a.startSample / sampleRate).toFixed(2)}–{(a.endSample / sampleRate).toFixed(2)}s
                </span>
                <span className="ml-auto text-[11px] text-[rgb(var(--muted))]">
                  {(a.confidence * 100).toFixed(0)}% conf.
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
