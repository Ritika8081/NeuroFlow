/**
 * Local AI assistant that answers EEG questions using the current analysis.
 * Implements an intent classifier + structured response generator. Numbers
 * come from real DSP — the language layer is heuristic.
 *
 * This is intentionally not an LLM call: it works offline and reflects
 * what the data actually says, not what a model guessed.
 */

import { AnalysisBundle } from "./insights";
import { BAND_ORDER, BandName, BANDS } from "./dsp";

export interface AssistantContext {
  analysis: AnalysisBundle;
  channelNames: string[];
  sampleRate: number;
  durationSec: number;
  fileName: string;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  timestamp: number;
}

interface Intent {
  match: (q: string) => boolean;
  reply: (q: string, ctx: AssistantContext) => string;
}

const matchesAny = (q: string, terms: string[]) =>
  terms.some((t) => new RegExp(`\\b${t}\\b`, "i").test(q));

const matchesBand = (q: string): BandName | null => {
  for (const b of BAND_ORDER) {
    if (new RegExp(`\\b${b}\\b`, "i").test(q)) return b;
  }
  return null;
};

const fmt = (n: number, d = 2) => n.toFixed(d);

const INTENTS: Intent[] = [
  // band power
  {
    match: (q) => matchesBand(q) !== null && matchesAny(q, ["power", "show", "what", "how much", "level"]),
    reply: (q, ctx) => {
      const b = matchesBand(q)!;
      const total = ctx.analysis.avgBands.total || 1;
      const v = ctx.analysis.avgBands[b];
      const pct = (v / total) * 100;
      const perChan = ctx.analysis.perChannelBands
        .map((c) => ({ name: c.name, rel: c[b] / (c.total || 1) }))
        .sort((a, b) => b.rel - a.rel);
      const top = perChan.slice(0, 3);
      return [
        `**${b.toUpperCase()} band power** averages ${fmt(pct, 1)}% of the total spectrum (${BANDS[b][0]}–${BANDS[b][1]} Hz).`,
        ``,
        `Top channels: ${top.map((c) => `${c.name} (${fmt(c.rel * 100, 0)}%)`).join(", ")}.`,
        ``,
        bandInterpretation(b, pct),
      ].join("\n");
    },
  },
  // cognitive state
  {
    match: (q) =>
      matchesAny(q, ["state", "cognitive", "focus", "focused", "drowsy", "relaxed", "alert", "stress", "meditat"]),
    reply: (_, ctx) => {
      const c = ctx.analysis.cognitive;
      const lines = [
        `The recording most resembles a **${c.state}** state (${fmt(c.confidence * 100, 0)}% confidence).`,
        ``,
        `Key ratios:`,
        ...c.metrics.map((m) => `• ${m.name}: \`${fmt(m.value, 2)}\` — ${m.explanation}`),
      ];
      return lines.join("\n");
    },
  },
  // quality
  {
    match: (q) => matchesAny(q, ["quality", "snr", "noise", "artifact", "clean", "bad channel", "usable"]),
    reply: (_, ctx) => {
      const q = ctx.analysis.quality;
      return [
        `**Recording quality: ${q.overall}/100**`,
        ``,
        ...q.components.map((c) => `• ${c.name}: ${c.value}/100 (${c.note})`),
        ``,
        q.badChannels.length > 0
          ? `⚠️ Bad channels: ${q.badChannels.join(", ")}. Exclude these from averaging and topomaps.`
          : `All channels look usable.`,
      ].join("\n");
    },
  },
  // dominant rhythm
  {
    match: (q) => matchesAny(q, ["dominant", "main", "strongest", "rhythm"]),
    reply: (_, ctx) => {
      const b = ctx.analysis.dominantBand;
      const total = ctx.analysis.avgBands.total || 1;
      const pct = (ctx.analysis.avgBands[b] / total) * 100;
      return `The **${b}** band dominates the spectrum (~${fmt(pct, 0)}%). ${bandInterpretation(b, pct)}`;
    },
  },
  // alpha peak
  {
    match: (q) => matchesAny(q, ["peak", "iapf", "alpha frequency", "dominant frequency"]),
    reply: (_, ctx) => {
      const f = ctx.analysis.alphaPeakHz;
      if (!f) return "No clear alpha peak detected — typical alpha (8–13 Hz) is most visible at occipital channels (O1/O2/Pz).";
      return `**Individual alpha peak frequency** is ~${fmt(f, 1)} Hz. ${
        f < 8.5
          ? "Slowed alpha can indicate fatigue, cognitive decline, or pathology."
          : f > 11.5
          ? "Fast alpha is typical of younger, high-performing adults."
          : "Within the normal adult range."
      }`;
    },
  },
  // asymmetry
  {
    match: (q) => matchesAny(q, ["asymmetry", "faa", "lateralization", "approach", "withdrawal"]),
    reply: (_, ctx) => {
      const a = ctx.analysis.asymmetry;
      if (!a) return "Frontal alpha asymmetry needs both F3/F4 (or comparable left/right frontal pair) — they aren't both in this recording.";
      return `**Frontal alpha asymmetry: ${fmt(a.value, 2)}** → ${a.interpretation}. FAA is a research-grade affective valence proxy; treat as a soft signal.`;
    },
  },
  // recommendations / what should I do
  {
    match: (q) => matchesAny(q, ["recommend", "suggest", "next", "what should", "advice", "improve"]),
    reply: (_, ctx) => {
      const recs: string[] = [];
      const q = ctx.analysis.quality;
      if (q.overall < 60) recs.push("• Quality is poor — consider re-recording or excluding bad channels before analysis.");
      if (q.badChannels.length > 0) recs.push(`• Drop these channels: ${q.badChannels.join(", ")}.`);
      const muscle = ctx.analysis.findings.find((f) => /muscle/i.test(f.title));
      if (muscle) recs.push("• Lower the band-pass high cut-off or run ICA-based muscle removal.");
      const line = ctx.analysis.findings.find((f) => /Mains/i.test(f.title));
      if (line) recs.push("• Enable / tighten the notch filter (50 Hz EU/IN, 60 Hz US).");
      const blink = ctx.analysis.findings.find((f) => /blink/i.test(f.title));
      if (blink) recs.push("• Apply ICA-based EOG removal to clean frontal blinks.");
      if (recs.length === 0) recs.push("• Recording looks clean — proceed to your analysis of choice.");
      return ["**Recommendations**", "", ...recs].join("\n");
    },
  },
  // explain X
  {
    match: (q) => matchesAny(q, ["explain", "what is", "define", "tell me about"]),
    reply: (q) => {
      const b = matchesBand(q);
      if (b) return `**${b.toUpperCase()} band (${BANDS[b][0]}–${BANDS[b][1]} Hz)** — ${bandDefinition(b)}`;
      if (/notch/i.test(q)) return "A **notch filter** removes a narrow band around 50/60 Hz to suppress AC mains contamination without affecting nearby brain frequencies.";
      if (/bandpass/i.test(q)) return "A **band-pass filter** keeps frequencies within a range (e.g. 1–45 Hz) and rejects everything else. Standard EEG practice.";
      if (/ica/i.test(q)) return "**Independent Component Analysis (ICA)** decomposes mixed EEG signals into statistically independent sources. Useful for removing eye/muscle artifacts by zeroing the offending components.";
      if (/topograph|topomap/i.test(q)) return "A **topographic map** projects channel values onto a head outline using their 10-20 positions, interpolating between electrodes to reveal spatial patterns.";
      if (/psd|spectral|spectrum/i.test(q)) return "**Power spectral density (PSD)** shows how signal power is distributed across frequencies — usually computed with Welch's method (overlapping FFT windows).";
      return "I can explain bands (delta/theta/alpha/beta/gamma), filters (notch, band-pass, high-pass), ICA, topomaps, PSD, and the quality / cognitive state metrics shown in the dashboards.";
    },
  },
  // recording basics
  {
    match: (q) => matchesAny(q, ["channels", "duration", "fs", "sample rate", "sampling"]),
    reply: (_, ctx) =>
      `**${ctx.fileName}** — ${ctx.channelNames.length} channels (${ctx.channelNames.join(", ")}) at ${ctx.sampleRate} Hz, total ${fmt(ctx.durationSec, 1)} s.`,
  },
];

export function ask(question: string, ctx: AssistantContext): string {
  const q = question.trim();
  if (!q) return "Ask me about band powers, cognitive state, quality, the alpha peak, asymmetry, or 'what should I do next?'";
  for (const intent of INTENTS) {
    if (intent.match(q)) return intent.reply(q, ctx);
  }
  // Generic catch-all summary
  const a = ctx.analysis;
  return [
    `Here's what I can see in **${ctx.fileName}**:`,
    `• Likely state: **${a.cognitive.state}** (${fmt(a.cognitive.confidence * 100, 0)}% confidence)`,
    `• Dominant rhythm: **${a.dominantBand}**`,
    `• Quality: **${a.quality.overall}/100**`,
    `• Bad channels: ${a.quality.badChannels.length ? a.quality.badChannels.join(", ") : "none"}`,
    ``,
    `Try: *"how much alpha?"*, *"explain theta"*, *"what should I do next?"*, *"frontal asymmetry?"*`,
  ].join("\n");
}

function bandDefinition(b: BandName): string {
  switch (b) {
    case "delta":
      return "Slowest band — dominant in deep sleep (N3) and pathology when awake. Be suspicious of awake-state delta unless from drift artifact.";
    case "theta":
      return "Linked to drowsiness, meditation, memory encoding, and frontal-midline executive activity.";
    case "alpha":
      return "Posterior dominant rhythm of relaxed wakefulness; blocked by eye opening. Individual peak ~9–11 Hz.";
    case "beta":
      return "Active cognition, attention, motor planning. Can be contaminated by EMG above 20 Hz.";
    case "gamma":
      return "High-frequency activity tied to attention and binding — but in scalp EEG often EMG. Interpret carefully.";
  }
}

function bandInterpretation(b: BandName, pct: number): string {
  if (b === "delta" && pct > 35) return "Elevated delta in awake EEG often reflects drift or pathology — sanity-check the high-pass filter.";
  if (b === "theta" && pct > 25) return "Elevated theta — drowsiness, meditation, or strong frontal-midline engagement.";
  if (b === "alpha" && pct > 30) return "Strong alpha — typical of resting wakefulness with eyes closed.";
  if (b === "beta" && pct > 30) return "Elevated beta — active cognition or possible muscle contamination.";
  if (b === "gamma" && pct > 20) return "High gamma in scalp EEG is usually muscle. Check topography — broad/peripheral = EMG.";
  return "";
}

/* ------------------------------------------------------------------ */
/*  Natural-language filter parser                                    */
/* ------------------------------------------------------------------ */

export interface ParsedPipelineRequest {
  bandpassLow?: number;
  bandpassHigh?: number;
  notchFreq?: number;
  lowpassFreq?: number | null;
  highpassFreq?: number | null;
  rationale: string;
}

/**
 * Parse a free-text request like "clean for sleep analysis, 0.3-35 Hz, notch 60"
 * into a partial filter config. Best-effort.
 */
export function parsePipelineRequest(text: string): ParsedPipelineRequest | null {
  const t = text.toLowerCase();
  const out: ParsedPipelineRequest = { rationale: "" };

  // band-pass range like "1-45 Hz"
  const range = t.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*hz/);
  if (range) {
    out.bandpassLow = Number(range[1]);
    out.bandpassHigh = Number(range[2]);
  }
  // explicit "highpass at 0.5"
  const hp = t.match(/(?:high[-\s]?pass|hpf)\s*(?:at|=)?\s*(\d+(?:\.\d+)?)/);
  if (hp) out.highpassFreq = Number(hp[1]);
  const lp = t.match(/(?:low[-\s]?pass|lpf)\s*(?:at|=)?\s*(\d+(?:\.\d+)?)/);
  if (lp) out.lowpassFreq = Number(lp[1]);
  const notch = t.match(/notch\s*(?:at|=)?\s*(\d+)/);
  if (notch) out.notchFreq = Number(notch[1]);

  // semantic shortcuts
  if (/sleep/.test(t)) {
    out.bandpassLow ??= 0.3;
    out.bandpassHigh ??= 35;
    out.rationale = "Sleep analysis preset: 0.3–35 Hz preserves slow waves, sleep spindles, and K-complexes.";
  } else if (/erp|cognit|task/.test(t)) {
    out.bandpassLow ??= 0.5;
    out.bandpassHigh ??= 30;
    out.rationale = "ERP/cognitive preset: 0.5–30 Hz keeps slow components and rejects EMG.";
  } else if (/bci|motor imagery|mi/.test(t)) {
    out.bandpassLow ??= 8;
    out.bandpassHigh ??= 30;
    out.rationale = "BCI / motor imagery preset: 8–30 Hz isolates the µ and β rhythms.";
  } else if (/relax|rest/.test(t)) {
    out.bandpassLow ??= 1;
    out.bandpassHigh ??= 45;
    out.rationale = "Resting-state preset: 1–45 Hz standard.";
  }

  if (!out.bandpassLow && !out.bandpassHigh && !out.notchFreq && !out.lowpassFreq && !out.highpassFreq) {
    return null;
  }
  if (!out.rationale) out.rationale = "Applied your requested filter values.";
  return out;
}
