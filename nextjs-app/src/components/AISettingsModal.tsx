"use client";

import React, { useState } from "react";
import { PROVIDERS, ProviderDef, ProviderId } from "../lib/ai-providers";
import { testConnection } from "../lib/ai-client";
import { useAI } from "./AIProvider";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TIER_COLORS: Record<string, string> = {
  free: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  paid: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  mixed: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  local: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
};

export default function AISettingsModal({ open, onClose }: Props) {
  const { config, setActiveProvider, updateProvider } = useAI();
  const [selected, setSelected] = useState<ProviderId | "local" | null>(config.activeProvider);
  const [testing, setTesting] = useState<ProviderId | "local" | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; ms?: number }>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  if (!open) return null;

  const handleTest = async (id: ProviderId | "local") => {
    setTesting(id);
    const result = await testConnection({ ...config, activeProvider: id });
    setTestResults((p) => ({ ...p, [id]: result }));
    setTesting(null);
  };

  const handleActivate = (id: ProviderId | "local") => {
    setSelected(id);
    setActiveProvider(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-up">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] glass-strong rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div className="eyebrow">
              Settings
            </div>
            <div className="text-lg font-semibold">AI providers · bring your own key</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Privacy banner */}
        <div className="m-4 mt-4 rounded-xl border border-[rgb(var(--accent))]/30 bg-[rgb(var(--accent-bg))] px-4 py-3 text-xs text-[rgb(var(--text-soft))]">
          <span className="text-[rgb(var(--accent-fg))] font-medium">Privacy:</span> all API keys are stored
          locally in this browser and sent only from your machine to the provider you choose.
          NeuroFlow Lab has no backend that sees your keys.
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6 space-y-3">
          {/* Local option */}
          <div
            className={`rounded-xl border p-4 transition ${
              selected === "local"
                ? "border-[rgb(var(--accent))]/50 bg-[rgb(var(--accent-bg))]"
                : "hover:border-[rgb(var(--accent))]/30"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">Local heuristics</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TIER_COLORS.local}`}>
                    offline · free
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    default
                  </span>
                </div>
                <div className="text-sm text-[rgb(var(--muted))] mt-1">
                  Built-in deterministic responses grounded in DSP metrics. Zero network calls.
                  Always available as a fallback.
                </div>
              </div>
              <button
                onClick={() => handleActivate("local")}
                className={`btn ${selected === "local" ? "btn-primary" : "btn-secondary"} text-xs`}
              >
                {selected === "local" ? "✓ Active" : "Use"}
              </button>
            </div>
          </div>

          {PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isActive={selected === p.id}
              currentKey={config.perProvider[p.id]?.apiKey ?? ""}
              currentModel={config.perProvider[p.id]?.model ?? p.defaultModel}
              currentBaseUrl={config.perProvider[p.id]?.baseUrl ?? p.baseUrl}
              testing={testing === p.id}
              testResult={testResults[p.id]}
              showKey={!!showKey[p.id]}
              onToggleShowKey={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}
              onChangeKey={(v) => updateProvider(p.id, { apiKey: v })}
              onChangeModel={(v) => updateProvider(p.id, { model: v })}
              onChangeBaseUrl={(v) => updateProvider(p.id, { baseUrl: v })}
              onTest={() => handleTest(p.id)}
              onActivate={() => handleActivate(p.id)}
            />
          ))}
        </div>

        <div className="px-6 py-3 border-t flex items-center justify-between text-xs text-[rgb(var(--muted))]">
          <span>{Object.keys(config.perProvider).length} provider(s) configured</span>
          <button onClick={onClose} className="btn btn-primary text-xs">Done</button>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  isActive,
  currentKey,
  currentModel,
  currentBaseUrl,
  testing,
  testResult,
  showKey,
  onToggleShowKey,
  onChangeKey,
  onChangeModel,
  onChangeBaseUrl,
  onTest,
  onActivate,
}: {
  provider: ProviderDef;
  isActive: boolean;
  currentKey: string;
  currentModel: string;
  currentBaseUrl: string;
  testing: boolean;
  testResult?: { ok: boolean; message: string; ms?: number };
  showKey: boolean;
  onToggleShowKey: () => void;
  onChangeKey: (v: string) => void;
  onChangeModel: (v: string) => void;
  onChangeBaseUrl: (v: string) => void;
  onTest: () => void;
  onActivate: () => void;
}) {
  const [expanded, setExpanded] = useState(isActive || currentKey.length > 0);

  return (
    <div
      className={`rounded-xl border transition ${
        isActive ? "border-[rgb(var(--accent))]/50 bg-[rgb(var(--accent-bg))]" : "hover:border-[rgb(var(--accent))]/30"
      }`}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full px-4 py-3 flex items-start justify-between text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{provider.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TIER_COLORS[provider.pricing]}`}>
              {provider.pricing}
            </span>
            {!!currentKey && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                key set
              </span>
            )}
            {isActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgb(var(--accent-bg))] text-[rgb(var(--accent-fg))] border border-[rgb(var(--accent))]/30">
                active
              </span>
            )}
          </div>
          <div className="text-sm text-[rgb(var(--muted))] mt-1">{provider.tagline}</div>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 mt-1 text-[rgb(var(--muted))] transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {provider.pricing !== "local" && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))] block mb-1">
                API key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={currentKey}
                    onChange={(e) => onChangeKey(e.target.value)}
                    placeholder={provider.keyHint || "your API key"}
                    className="input pr-9 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={onToggleShowKey}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
                    aria-label={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 10.677a3 3 0 014.243 4.243M9.88 4.6A10.05 10.05 0 0112 4c5 0 9 3 11 8a17.6 17.6 0 01-3.18 4.62M6.61 6.62A17.6 17.6 0 001 12c2 5 6 8 11 8a10.05 10.05 0 003.5-.63" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <a
                  href={provider.signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary text-xs"
                >
                  Get key
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
            </div>
          )}

          {!provider.fixedBaseUrl && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))] block mb-1">
                Base URL
              </label>
              <input
                value={currentBaseUrl}
                onChange={(e) => onChangeBaseUrl(e.target.value)}
                placeholder={provider.baseUrl}
                className="input font-mono text-sm"
              />
              {provider.browserNote && (
                <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">{provider.browserNote}</div>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))] block mb-1">
              Model
            </label>
            <select
              value={currentModel}
              onChange={(e) => onChangeModel(e.target.value)}
              className="input select"
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.context ? ` · ${m.context}` : ""}
                  {m.tier && m.tier !== "premium" ? ` · ${m.tier}` : ""}
                  {m.notes ? ` · ${m.notes}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button onClick={onActivate} className={`btn ${isActive ? "btn-primary" : "btn-secondary"} text-xs`}>
              {isActive ? "✓ Active" : "Use this provider"}
            </button>
            <button onClick={onTest} disabled={testing} className="btn btn-ghost text-xs">
              {testing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  testing…
                </>
              ) : (
                "Test connection"
              )}
            </button>
            <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[rgb(var(--muted))] hover:text-[rgb(var(--accent-fg))] ml-auto">
              docs ↗
            </a>
          </div>

          {testResult && (
            <div
              className={`text-xs rounded-lg border px-3 py-2 ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              }`}
            >
              {testResult.ok ? "✓ " : "✗ "}
              {testResult.message}
              {testResult.ms !== undefined && ` · ${testResult.ms}ms`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
