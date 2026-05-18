/**
 * Persisted AI configuration. Everything lives in localStorage — keys never
 * leave the user's browser unless they invoke a model call (in which case the
 * key is sent directly from the browser to the provider's endpoint).
 */

import { ProviderId, getProvider } from "./ai-providers";

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string; // for self-hosted (Ollama, custom OpenAI-compat)
}

export interface AIConfig {
  activeProvider: ProviderId | "local";
  perProvider: Partial<Record<ProviderId, ProviderConfig>>;
}

const KEY = "nfl-ai-config-v1";

export function defaultConfig(): AIConfig {
  return { activeProvider: "local", perProvider: {} };
}

export function loadConfig(): AIConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as AIConfig;
    return {
      activeProvider: parsed.activeProvider ?? "local",
      perProvider: parsed.perProvider ?? {},
    };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: AIConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {}
}

export function isConfigured(config: AIConfig): boolean {
  if (config.activeProvider === "local") return true; // heuristic always works
  const pc = config.perProvider[config.activeProvider];
  if (!pc) return false;
  // Ollama uses base URL, no key required
  if (config.activeProvider === "ollama") return true;
  return !!pc.apiKey;
}

export function activeModel(config: AIConfig): { providerId: ProviderId | "local"; model: string; label: string } {
  if (config.activeProvider === "local") {
    return { providerId: "local", model: "heuristic", label: "Local heuristics (offline)" };
  }
  const provider = getProvider(config.activeProvider);
  const pc = config.perProvider[config.activeProvider];
  const model = pc?.model ?? provider?.defaultModel ?? "?";
  return {
    providerId: config.activeProvider,
    model,
    label: `${provider?.label ?? config.activeProvider} · ${model}`,
  };
}
