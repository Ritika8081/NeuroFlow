"use client";

import React, { useState } from "react";
import { GLOSSARY, GlossaryEntry } from "../lib/glossary";

export default function GlossaryView() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered: GlossaryEntry[] = query.trim()
    ? GLOSSARY.filter(
        (e) =>
          e.term.toLowerCase().includes(query.toLowerCase()) ||
          e.short.toLowerCase().includes(query.toLowerCase()) ||
          e.aliases?.some((a) => a.toLowerCase().includes(query.toLowerCase()))
      )
    : GLOSSARY;

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Knowledge</div>
        <h3 className="font-medium mt-1">EEG glossary</h3>
        <p className="text-sm text-[rgb(var(--muted))] mt-1">
          Quick reference for terms used across the workspace. {GLOSSARY.length} entries.
        </p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search terms…"
        className="input"
      />

      <div className="divide-y border rounded-xl overflow-hidden bg-[rgb(var(--surface))]">
        {filtered.map((e) => {
          const open = expanded === e.term;
          return (
            <div key={e.term}>
              <button
                onClick={() => setExpanded(open ? null : e.term)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[rgb(var(--surface-2))]"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{e.term}</div>
                  <div className="text-xs text-[rgb(var(--muted))] truncate">{e.short}</div>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={`h-3.5 w-3.5 text-[rgb(var(--muted))] transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open && (
                <div className="px-4 pb-4 -mt-1 animate-fade-up">
                  <p className="text-sm text-[rgb(var(--text-soft))] leading-relaxed">{e.detail}</p>
                  {e.aliases && e.aliases.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.aliases.map((a) => (
                        <span key={a} className="chip">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-5 text-sm text-[rgb(var(--muted))] text-center">
            No terms match "{query}".
          </div>
        )}
      </div>
    </div>
  );
}
