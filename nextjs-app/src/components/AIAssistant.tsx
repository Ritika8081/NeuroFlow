"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AssistantContext,
  AssistantMessage,
  ask,
  parsePipelineRequest,
  ParsedPipelineRequest,
} from "../lib/assistant";
import { callLLM, LLMError, LLMMessage } from "../lib/ai-client";
import { useAI } from "./AIProvider";
import { ASSISTANT_SYSTEM, recordingContextBlock } from "../lib/ai-prompts";

interface Props {
  context: AssistantContext | null;
  onApplyPipeline?: (req: ParsedPipelineRequest) => void;
  onOpenSettings?: () => void;
}

const SUGGESTIONS = [
  "Summarize this recording",
  "What's the cognitive state?",
  "How much alpha power?",
  "Any bad channels?",
  "Explain frontal asymmetry",
  "Clean for sleep, notch 60",
];

export default function AIAssistant({ context, onApplyPipeline, onOpenSettings }: Props) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<AssistantMessage[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { config, active } = useAI();
  const isLocal = config.activeProvider === "local";

  const clearWithUndo = () => {
    if (messages.length === 0) return;
    setUndoSnapshot(messages);
    setMessages([]);
    setError(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setUndoSnapshot(null), 6000);
  };

  const undoClear = () => {
    if (!undoSnapshot) return;
    setMessages(undoSnapshot);
    setUndoSnapshot(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  };

  useEffect(() => () => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (context && messages.length === 0) {
      setMessages([
        { role: "assistant", content: greeting(context, isLocal), timestamp: Date.now() },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || !context) return;
    setInput("");
    setError(null);
    const user: AssistantMessage = { role: "user", content: q, timestamp: Date.now() };
    const history = [...messages, user];
    setMessages(history);
    setThinking(true);

    // Pipeline parser always runs first — it's deterministic and useful.
    const parsed = parsePipelineRequest(q);
    if (parsed && onApplyPipeline) {
      onApplyPipeline(parsed);
      const reply = [
        `✅ **Pipeline updated.** ${parsed.rationale}`,
        ``,
        parsed.bandpassLow !== undefined ? `• Band-pass low: \`${parsed.bandpassLow} Hz\`` : "",
        parsed.bandpassHigh !== undefined ? `• Band-pass high: \`${parsed.bandpassHigh} Hz\`` : "",
        parsed.notchFreq !== undefined ? `• Notch: \`${parsed.notchFreq} Hz\`` : "",
        parsed.highpassFreq !== undefined && parsed.highpassFreq !== null
          ? `• High-pass: \`${parsed.highpassFreq} Hz\``
          : "",
        parsed.lowpassFreq !== undefined && parsed.lowpassFreq !== null
          ? `• Low-pass: \`${parsed.lowpassFreq} Hz\``
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      setMessages((m) => [...m, { role: "assistant", content: reply, timestamp: Date.now() }]);
      setThinking(false);
      return;
    }

    // Local heuristic mode
    if (isLocal) {
      await new Promise((r) => setTimeout(r, 220 + Math.random() * 280));
      const reply = ask(q, context);
      setMessages((m) => [...m, { role: "assistant", content: reply, timestamp: Date.now() }]);
      setThinking(false);
      return;
    }

    // Real LLM mode
    abortRef.current = new AbortController();
    try {
      const llmHistory: LLMMessage[] = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const sys = `${ASSISTANT_SYSTEM}\n\n${recordingContextBlock({
        fileName: context.fileName,
        channels: context.channelNames.length,
        channelNames: context.channelNames,
        sampleRate: context.sampleRate,
        durationSec: context.durationSec,
        analysis: context.analysis,
      })}`;
      const result = await callLLM(config, {
        system: sys,
        messages: llmHistory,
        temperature: 0.4,
        maxTokens: 800,
        signal: abortRef.current.signal,
      });
      setMessages((m) => [...m, { role: "assistant", content: result.text, timestamp: Date.now() }]);
    } catch (e: any) {
      const msg = e instanceof LLMError ? `${e.providerId} error · ${e.message}` : e?.message ?? "LLM call failed";
      setError(msg);
      // Graceful fallback to local heuristic
      const fallback = ask(q, context);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `⚠️ ${msg}\n\n_Falling back to offline analysis:_\n\n${fallback}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setThinking(false);
  };

  return (
    <div className="flex flex-col h-[640px] glass rounded-2xl overflow-hidden">
      <header className="px-5 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md border bg-[rgb(var(--surface-2))] flex items-center justify-center text-[rgb(var(--muted))]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12a3 3 0 116 0 3 3 0 01-6 0zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
              />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-sm">NeuroFlow assistant</div>
            <div className="text-[10px] text-[rgb(var(--muted))] flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${isLocal ? "bg-[rgb(var(--subtle))]" : "bg-emerald-500"}`} />
              {active.label}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <button onClick={onOpenSettings} className="btn btn-ghost text-xs" title="AI providers">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <circle cx="12" cy="12" r="3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Provider
            </button>
          )}
          <button onClick={clearWithUndo} disabled={messages.length === 0} className="btn btn-ghost text-xs">
            Reset
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
        {!context && (
          <div className="text-center text-sm text-[rgb(var(--muted))] py-12">
            Load a recording to start chatting.
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-[rgb(var(--muted))] text-xs" role="status" aria-live="polite">
            <div className="flex items-end gap-1 h-3 text-[rgb(var(--accent))]/70" aria-hidden="true">
              <span className="wave-bar h-full" />
              <span className="wave-bar h-full" style={{ animationDelay: "0.15s" }} />
              <span className="wave-bar h-full" style={{ animationDelay: "0.3s" }} />
            </div>
            thinking
            <button onClick={stop} className="ml-2 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger))] underline underline-offset-2">
              stop
            </button>
          </div>
        )}
      </div>

      {undoSnapshot && (
        <div role="status" aria-live="polite" className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-md border bg-[rgb(var(--surface-2))] px-3 py-2 text-xs text-[rgb(var(--text-soft))] animate-fade-up">
          <span>Chat cleared.</span>
          <button onClick={undoClear} className="btn btn-ghost text-xs">
            Undo
          </button>
        </div>
      )}

      {context && messages.length <= 1 && (
        <div className="px-5 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-md border bg-[rgb(var(--surface-2))] hover:bg-[rgb(var(--surface))] transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="px-5 pb-1">
          <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1">
            {error} {onOpenSettings && <button onClick={onOpenSettings} className="underline">Configure</button>}
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={context ? "Ask anything about this recording…" : "Load a recording first"}
          disabled={!context}
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={!context || !input.trim() || thinking}
          className="btn btn-primary px-3"
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function greeting(ctx: AssistantContext, isLocal: boolean): string {
  const a = ctx.analysis;
  return [
    `Hi — I've analyzed **${ctx.fileName}** (${ctx.channelNames.length}ch @ ${ctx.sampleRate} Hz, ${ctx.durationSec.toFixed(1)}s).`,
    ``,
    `**TL;DR**`,
    `• State: **${a.cognitive.state}** (${(a.cognitive.confidence * 100).toFixed(0)}% confidence)`,
    `• Dominant rhythm: **${a.dominantBand}**`,
    `• Quality: **${a.quality.overall}/100**${a.quality.badChannels.length ? ` · ${a.quality.badChannels.length} bad channel(s)` : ""}`,
    ``,
    isLocal
      ? `_Using offline heuristics. Add an AI provider (Groq, Gemini, etc.) in settings to unlock a real LLM._`
      : `_Ask me anything — I can reason about your data and update the filter pipeline from plain English._`,
  ].join("\n");
}

function Bubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-up`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[rgb(var(--accent))] text-white rounded-br-sm dark:text-[rgb(20,18,25)]"
            : "bg-[rgb(var(--surface-2))] border rounded-bl-sm"
        }`}
      >
        {renderMarkdown(message.content)}
      </div>
    </div>
  );
}

/** Tiny markdown-ish renderer — bold + inline code + headings + lists. */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      out.push(<div key={i} className="font-semibold text-sm mt-2 mb-1">{renderInline(line.slice(3))}</div>);
    } else if (line.startsWith("# ")) {
      out.push(<div key={i} className="font-semibold text-base mt-2 mb-1">{renderInline(line.slice(2))}</div>);
    } else if (/^[-•*]\s/.test(line)) {
      out.push(<div key={i} className="ml-3">• {renderInline(line.replace(/^[-•*]\s/, ""))}</div>);
    } else if (line.trim() === "") {
      out.push(<div key={i}>&nbsp;</div>);
    } else {
      out.push(<div key={i}>{renderInline(line)}</div>);
    }
  });
  return <>{out}</>;
}

function renderInline(line: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;
  while (remaining.length > 0) {
    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    const ital = remaining.match(/^_(.+?)_/);
    const code = remaining.match(/^`(.+?)`/);
    if (bold) {
      tokens.push(<strong key={key++}>{bold[1]}</strong>);
      remaining = remaining.slice(bold[0].length);
    } else if (ital) {
      tokens.push(<em key={key++} className="opacity-80">{ital[1]}</em>);
      remaining = remaining.slice(ital[0].length);
    } else if (code) {
      tokens.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-[rgb(var(--surface-3))] mono text-[12px]">
          {code[1]}
        </code>
      );
      remaining = remaining.slice(code[0].length);
    } else {
      const next = remaining.search(/\*\*|`|_/);
      const chunk = next === -1 ? remaining : remaining.slice(0, next);
      tokens.push(<React.Fragment key={key++}>{chunk}</React.Fragment>);
      remaining = next === -1 ? "" : remaining.slice(next);
    }
  }
  return <>{tokens}</>;
}
