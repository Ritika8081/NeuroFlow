/**
 * AI provider registry. Each provider exposes one or more models the user
 * can pick. Keys are stored locally in the user's browser only.
 *
 * Pricing tier is informational: 'free' means the provider offers a usable
 * free tier; 'paid' means the user pays per-token; 'mixed' = both.
 */

export type ProviderId =
  | "groq"
  | "gemini"
  | "openrouter"
  | "mistral"
  | "ollama"
  | "openai"
  | "anthropic"
  | "together"
  | "huggingface";

export type RequestFormat = "openai" | "anthropic" | "gemini" | "ollama" | "huggingface";
export type PricingTier = "free" | "paid" | "mixed" | "local";

export interface ModelDef {
  id: string;
  label: string;
  context?: string;
  tier?: "free" | "cheap" | "premium" | "local";
  notes?: string;
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  tagline: string;
  baseUrl: string;
  format: RequestFormat;
  pricing: PricingTier;
  signupUrl: string;
  docsUrl: string;
  keyHint?: string;
  /** If false, the user supplies a custom base URL (e.g. Ollama). */
  fixedBaseUrl?: boolean;
  models: ModelDef[];
  defaultModel: string;
  /** Whether browser CORS access is officially supported. */
  browserSupported: boolean;
  browserNote?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "groq",
    label: "Groq",
    tagline: "Free · ultra-fast Llama / Mixtral / Gemma inference",
    baseUrl: "https://api.groq.com/openai/v1",
    format: "openai",
    pricing: "free",
    signupUrl: "https://console.groq.com/keys",
    docsUrl: "https://console.groq.com/docs/models",
    keyHint: "gsk_…",
    fixedBaseUrl: true,
    browserSupported: true,
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", context: "128k", tier: "free" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", context: "128k", tier: "free" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8×7B", context: "32k", tier: "free" },
      { id: "gemma2-9b-it", label: "Gemma 2 9B", context: "8k", tier: "free" },
      { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill 70B", context: "128k", tier: "free", notes: "reasoning model" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    tagline: "Free · generous quota · multimodal",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    format: "gemini",
    pricing: "free",
    signupUrl: "https://aistudio.google.com/apikey",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
    keyHint: "AIza…",
    fixedBaseUrl: true,
    browserSupported: true,
    defaultModel: "gemini-2.0-flash",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", context: "1M", tier: "free" },
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", context: "1M", tier: "free" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", context: "1M", tier: "free" },
      { id: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B", context: "1M", tier: "free" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", context: "2M", tier: "premium" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    tagline: "Aggregator · many free models · pay-per-use premium",
    baseUrl: "https://openrouter.ai/api/v1",
    format: "openai",
    pricing: "mixed",
    signupUrl: "https://openrouter.ai/keys",
    docsUrl: "https://openrouter.ai/models",
    keyHint: "sk-or-…",
    fixedBaseUrl: true,
    browserSupported: true,
    defaultModel: "google/gemini-2.0-flash-exp:free",
    models: [
      { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (free)", tier: "free" },
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (free)", tier: "free" },
      { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (free)", tier: "free", notes: "reasoning" },
      { id: "deepseek/deepseek-chat:free", label: "DeepSeek Chat (free)", tier: "free" },
      { id: "qwen/qwen-2.5-coder-32b-instruct:free", label: "Qwen 2.5 Coder 32B (free)", tier: "free" },
      { id: "microsoft/phi-3-medium-128k-instruct:free", label: "Phi-3 Medium (free)", tier: "free" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", tier: "premium" },
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini", tier: "cheap" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    tagline: "Free tier · European AI",
    baseUrl: "https://api.mistral.ai/v1",
    format: "openai",
    pricing: "free",
    signupUrl: "https://console.mistral.ai/api-keys/",
    docsUrl: "https://docs.mistral.ai/getting-started/models/",
    fixedBaseUrl: true,
    browserSupported: true,
    defaultModel: "mistral-small-latest",
    models: [
      { id: "mistral-small-latest", label: "Mistral Small", tier: "free" },
      { id: "mistral-large-latest", label: "Mistral Large", tier: "premium" },
      { id: "open-mistral-nemo", label: "Mistral Nemo (open)", tier: "free" },
      { id: "codestral-latest", label: "Codestral", tier: "free", notes: "code-focused" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    tagline: "Run models on your own machine — fully private, fully free",
    baseUrl: "http://localhost:11434",
    format: "ollama",
    pricing: "local",
    signupUrl: "https://ollama.com/download",
    docsUrl: "https://github.com/ollama/ollama",
    fixedBaseUrl: false,
    browserSupported: true,
    browserNote: "Requires OLLAMA_ORIGINS env var to allow your site origin.",
    defaultModel: "llama3.2",
    models: [
      { id: "llama3.2", label: "Llama 3.2 (3B)", tier: "local" },
      { id: "llama3.1", label: "Llama 3.1 (8B)", tier: "local" },
      { id: "qwen2.5", label: "Qwen 2.5 (7B)", tier: "local" },
      { id: "mistral", label: "Mistral 7B", tier: "local" },
      { id: "phi3", label: "Phi-3", tier: "local" },
      { id: "gemma2", label: "Gemma 2", tier: "local" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    tagline: "Paid · GPT-4o family",
    baseUrl: "https://api.openai.com/v1",
    format: "openai",
    pricing: "paid",
    signupUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://platform.openai.com/docs/models",
    keyHint: "sk-…",
    fixedBaseUrl: true,
    browserSupported: true,
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "cheap" },
      { id: "gpt-4o", label: "GPT-4o", tier: "premium" },
      { id: "o1-mini", label: "o1-mini", tier: "premium", notes: "reasoning" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", tier: "premium" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    tagline: "Paid · Claude 4 family",
    baseUrl: "https://api.anthropic.com/v1",
    format: "anthropic",
    pricing: "paid",
    signupUrl: "https://console.anthropic.com/settings/keys",
    docsUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    keyHint: "sk-ant-…",
    fixedBaseUrl: true,
    browserSupported: true,
    browserNote: "Direct browser access requires anthropic-dangerous-direct-browser-access header.",
    defaultModel: "claude-haiku-4-5",
    models: [
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tier: "cheap" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "premium" },
      { id: "claude-opus-4-7", label: "Claude Opus 4.7", tier: "premium" },
    ],
  },
  {
    id: "together",
    label: "Together AI",
    tagline: "Free credits · many open-source models",
    baseUrl: "https://api.together.xyz/v1",
    format: "openai",
    pricing: "mixed",
    signupUrl: "https://api.together.xyz/settings/api-keys",
    docsUrl: "https://docs.together.ai/docs/inference-models",
    fixedBaseUrl: true,
    browserSupported: true,
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", tier: "cheap" },
      { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", label: "Llama 3.1 8B Turbo", tier: "free" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen 2.5 72B Turbo", tier: "cheap" },
      { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", tier: "cheap" },
    ],
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    tagline: "Free · serverless inference (rate-limited)",
    baseUrl: "https://api-inference.huggingface.co/models",
    format: "huggingface",
    pricing: "free",
    signupUrl: "https://huggingface.co/settings/tokens",
    docsUrl: "https://huggingface.co/docs/api-inference",
    keyHint: "hf_…",
    fixedBaseUrl: true,
    browserSupported: true,
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B", tier: "free" },
      { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct", tier: "free" },
      { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen 2.5 72B Instruct", tier: "free" },
      { id: "microsoft/Phi-3-mini-4k-instruct", label: "Phi-3 mini", tier: "free" },
    ],
  },
];

export function getProvider(id: ProviderId): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
