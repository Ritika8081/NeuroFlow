"use client";

import React, { useState } from "react";
import { useAI } from "./AIProvider";
import { callLLM, LLMError } from "../lib/ai-client";
import { Spinner } from "./ui";
import { AnalysisBundle } from "../lib/insights";

const SYSTEM = `You are a research librarian for EEG / cognitive neuroscience. Given a question
and the user's current recording findings, suggest 4-6 *plausible* relevant papers
(real preferred but may be representative). For each:
- Title (in quotes)
- Authors et al., Year
- Venue if known (one line)
- One-sentence relevance to the question.

Then write a short "How this connects to your recording" paragraph linking the suggestions
to the numerical findings provided.

Honesty rules:
- Never invent DOIs or links.
- If you're not confident a paper exists exactly, prefix with "Likely: ".
- Prefer canonical authors (e.g. Klimesch on alpha, Vallat on YASA, Niedermeyer for textbooks).

Format response as Markdown.`;

interface Props {
  analysis: AnalysisBundle;
  fileName: string;
  onOpenSettings: () => void;
}

export default function LiteratureSearch({ analysis, fileName, onOpenSettings }: Props) {
  const { config, active } = useAI();
  const isLocal = config.activeProvider === "local";
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = [
    "Frontal alpha asymmetry and emotion",
    "Sleep spindles and memory consolidation",
    "Individual alpha peak frequency in aging",
    "EMG artifact removal in EEG",
  ];

  const send = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const total = analysis.avgBands.total || 1;
      const ctx = [
        `Recording: ${fileName}`,
        `Cognitive state: ${analysis.cognitive.state} (${(analysis.cognitive.confidence * 100).toFixed(0)}% confidence)`,
        `Dominant rhythm: ${analysis.dominantBand}`,
        `Alpha peak: ${analysis.alphaPeakHz ? analysis.alphaPeakHz.toFixed(2) + " Hz" : "not detected"}`,
        `Quality: ${analysis.quality.overall}/100`,
        `Average band shares: ` +
          `delta=${((analysis.avgBands.delta / total) * 100).toFixed(0)}%, ` +
          `theta=${((analysis.avgBands.theta / total) * 100).toFixed(0)}%, ` +
          `alpha=${((analysis.avgBands.alpha / total) * 100).toFixed(0)}%, ` +
          `beta=${((analysis.avgBands.beta / total) * 100).toFixed(0)}%, ` +
          `gamma=${((analysis.avgBands.gamma / total) * 100).toFixed(0)}%`,
      ].join("\n");
      const result = await callLLM(config, {
        system: SYSTEM,
        messages: [
          { role: "user", content: `Question: ${text}\n\nMy recording context:\n${ctx}` },
        ],
        temperature: 0.4,
        maxTokens: 900,
      });
      setReply(result.text);
    } catch (e: any) {
      setError(e instanceof LLMError ? e.message : e?.message ?? "Search failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Knowledge</div>
        <h3 className="font-medium mt-1">Literature search</h3>
        <p className="text-sm text-[rgb(var(--muted))] mt-1">
          LLM-powered paper suggestions, grounded in your current recording's findings. Verify before citing.
        </p>
      </div>

      {isLocal && (
        <div className="surface rounded-xl p-4 text-sm text-[rgb(var(--muted))] text-center">
          A real LLM provider is required for literature search.{" "}
          <button onClick={onOpenSettings} className="underline text-[rgb(var(--accent-soft))]">
            Configure one
          </button>{" "}
          (Groq is free and instant).
        </div>
      )}

      {!isLocal && (
        <>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="chip hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a research question…"
              className="input flex-1"
              disabled={busy}
            />
            <button
              onClick={() => send()}
              disabled={busy || !query.trim()}
              className="btn btn-primary text-sm"
            >
              {busy ? <Spinner /> : "Search"}
            </button>
          </div>

          <div className="text-[10px] text-[rgb(var(--muted))]">{active.label}</div>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
              {error}
            </div>
          )}

          {reply && (
            <div className="surface rounded-xl p-5 whitespace-pre-wrap text-sm leading-relaxed max-h-[600px] overflow-auto">
              {reply}
            </div>
          )}
        </>
      )}
    </div>
  );
}
