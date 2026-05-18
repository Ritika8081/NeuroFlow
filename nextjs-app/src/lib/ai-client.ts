/**
 * Universal LLM client. Translates a single {system, messages} request into
 * the wire format each provider expects (OpenAI-compat, Anthropic, Gemini,
 * Ollama, Hugging Face).
 *
 * All requests run directly from the browser to the provider. The user's API
 * key never touches our origin.
 */

import { AIConfig } from "./ai-config";
import { ProviderId, getProvider } from "./ai-providers";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  system?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Wall-clock timeout in milliseconds. Default: 45_000 ms. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 45_000;

/** Combine a caller-supplied AbortSignal with a timeout. */
function withTimeout(opts: LLMCallOptions): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs} ms`)), timeoutMs);
  const onAbort = () => controller.abort(opts.signal?.reason);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort(opts.signal.reason);
    else opts.signal.addEventListener("abort", onAbort);
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    },
  };
}

export interface LLMCallResult {
  text: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
}

export class LLMError extends Error {
  constructor(public providerId: string, public status: number | null, message: string) {
    super(message);
    this.name = "LLMError";
  }
}

export async function callLLM(config: AIConfig, opts: LLMCallOptions): Promise<LLMCallResult> {
  if (config.activeProvider === "local") {
    throw new LLMError("local", null, "No remote LLM configured. Falling back to local heuristics.");
  }
  const provider = getProvider(config.activeProvider);
  if (!provider) throw new LLMError(config.activeProvider, null, "Unknown provider");
  const pc = config.perProvider[config.activeProvider] ?? {};
  const model = pc.model ?? provider.defaultModel;
  const baseUrl = pc.baseUrl ?? provider.baseUrl;
  const apiKey = pc.apiKey ?? "";
  if (provider.pricing !== "local" && !apiKey) {
    throw new LLMError(provider.id, null, "Missing API key for " + provider.label);
  }

  switch (provider.format) {
    case "openai":
      return callOpenAI({ baseUrl, apiKey, model, opts, providerId: provider.id });
    case "anthropic":
      return callAnthropic({ baseUrl, apiKey, model, opts });
    case "gemini":
      return callGemini({ baseUrl, apiKey, model, opts });
    case "ollama":
      return callOllama({ baseUrl, model, opts });
    case "huggingface":
      return callHuggingFace({ baseUrl, apiKey, model, opts });
  }
}

/* ------------------------------------------------------------------ */
/*  OpenAI-compatible (Groq, OpenRouter, Mistral, Together, OpenAI)   */
/* ------------------------------------------------------------------ */

async function callOpenAI({
  baseUrl,
  apiKey,
  model,
  opts,
  providerId,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  opts: LLMCallOptions;
  providerId: string;
}): Promise<LLMCallResult> {
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerId === "openrouter") {
    headers["HTTP-Referer"] = typeof window !== "undefined" ? window.location.origin : "neuroflow-lab";
    headers["X-Title"] = "NeuroFlow Lab";
  }

  const combined = withTimeout(opts);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      signal: combined.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1024,
        stream: false,
      }),
    });
    if (!res.ok) throw new LLMError(providerId, res.status, await safeError(res));
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    return {
      text,
      model,
      provider: providerId,
      promptTokens: json?.usage?.prompt_tokens,
      completionTokens: json?.usage?.completion_tokens,
    };
  } finally {
    combined.cleanup();
  }
}

/* ------------------------------------------------------------------ */
/*  Anthropic                                                          */
/* ------------------------------------------------------------------ */

async function callAnthropic({
  baseUrl,
  apiKey,
  model,
  opts,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  opts: LLMCallOptions;
}): Promise<LLMCallResult> {
  const combined = withTimeout(opts);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      signal: combined.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
        system: opts.system,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new LLMError("anthropic", res.status, await safeError(res));
    const json = await res.json();
    const text = (json?.content ?? []).map((c: any) => c?.text ?? "").join("");
    return {
      text,
      model,
      provider: "anthropic",
      promptTokens: json?.usage?.input_tokens,
      completionTokens: json?.usage?.output_tokens,
    };
  } finally {
    combined.cleanup();
  }
}

/* ------------------------------------------------------------------ */
/*  Google Gemini                                                      */
/* ------------------------------------------------------------------ */

async function callGemini({
  baseUrl,
  apiKey,
  model,
  opts,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  opts: LLMCallOptions;
}): Promise<LLMCallResult> {
  // Gemini expects "contents" with roles "user" / "model".
  const contents = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 1024,
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }
  const url = `${baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const combined = withTimeout(opts);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: combined.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new LLMError("gemini", res.status, await safeError(res));
    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    return {
      text,
      model,
      provider: "gemini",
      promptTokens: json?.usageMetadata?.promptTokenCount,
      completionTokens: json?.usageMetadata?.candidatesTokenCount,
    };
  } finally {
    combined.cleanup();
  }
}

/* ------------------------------------------------------------------ */
/*  Ollama (local)                                                     */
/* ------------------------------------------------------------------ */

async function callOllama({
  baseUrl,
  model,
  opts,
}: {
  baseUrl: string;
  model: string;
  opts: LLMCallOptions;
}): Promise<LLMCallResult> {
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const combined = withTimeout(opts);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      signal: combined.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: opts.temperature ?? 0.4,
          num_predict: opts.maxTokens ?? 1024,
        },
      }),
    });
    if (!res.ok) throw new LLMError("ollama", res.status, await safeError(res));
    const json = await res.json();
    return {
      text: json?.message?.content ?? "",
      model,
      provider: "ollama",
      promptTokens: json?.prompt_eval_count,
      completionTokens: json?.eval_count,
    };
  } finally {
    combined.cleanup();
  }
}

/* ------------------------------------------------------------------ */
/*  Hugging Face                                                       */
/* ------------------------------------------------------------------ */

async function callHuggingFace({
  baseUrl,
  apiKey,
  model,
  opts,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  opts: LLMCallOptions;
}): Promise<LLMCallResult> {
  // HF inference uses a prompt-style input; we'll concatenate.
  const prompt = [
    ...(opts.system ? [`System: ${opts.system}`] : []),
    ...opts.messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`),
    "Assistant:",
  ].join("\n\n");
  const combined = withTimeout(opts);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(model)}`, {
      method: "POST",
      signal: combined.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: opts.temperature ?? 0.4,
          max_new_tokens: opts.maxTokens ?? 512,
          return_full_text: false,
        },
      }),
    });
    if (!res.ok) throw new LLMError("huggingface", res.status, await safeError(res));
    const json = await res.json();
    let text = "";
    if (Array.isArray(json) && json[0]?.generated_text) text = json[0].generated_text;
    else if (typeof json === "object" && (json as any).generated_text) text = (json as any).generated_text;
    return { text, model, provider: "huggingface" };
  } finally {
    combined.cleanup();
  }
}

/* ------------------------------------------------------------------ */

async function safeError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json?.error?.message ?? json?.error ?? json?.message ?? `${res.status} ${res.statusText}`;
    } catch {
      return text.slice(0, 200) || `${res.status} ${res.statusText}`;
    }
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export async function testConnection(config: AIConfig): Promise<{ ok: boolean; message: string; ms?: number }> {
  if (config.activeProvider === "local") {
    return { ok: true, message: "Local heuristics — always available." };
  }
  const t0 = performance.now();
  try {
    const result = await callLLM(config, {
      messages: [{ role: "user", content: "Reply with the single word: OK" }],
      maxTokens: 5,
      temperature: 0,
    });
    const ms = Math.round(performance.now() - t0);
    return { ok: true, message: `Connected · ${result.text.trim().slice(0, 30) || "ok"}`, ms };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Connection failed" };
  }
}
