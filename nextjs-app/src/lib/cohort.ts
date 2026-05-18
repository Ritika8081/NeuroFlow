/**
 * Cohort QC. Manages a batch of analyzed recordings, computes per-subject
 * summaries, and ranks subjects by anomaly score so users can triage a
 * large dataset at a glance.
 */

import { AnalysisBundle, runAnalysis } from "./insights";
import { parseTextEEG } from "./sample-data";

export interface CohortSubject {
  id: string;
  fileName: string;
  channels: number;
  sampleRate: number;
  duration: number;
  channelNames: string[];
  analysis: AnalysisBundle;
  data: number[][];
  /** Higher = more unusual relative to cohort median. */
  anomalyScore: number;
  /** Per-component breakdown of anomaly score. */
  anomalyBreakdown: { name: string; z: number }[];
  /** Source: client-parsed (csv/json) or synthetic. */
  source: "client-parsed" | "synthetic";
  loadedAt: number;
}

export interface CohortStats {
  subjects: CohortSubject[];
  medians: {
    quality: number;
    dominantBandIndex: Record<string, number>;
    alphaPeakHz: number | null;
    badChannelCount: number;
  };
}

const KEY = "nfl-cohort-v1";

/* ---------- Persistence (lightweight summaries only) ---------- */

interface CohortSummary {
  id: string;
  fileName: string;
  channels: number;
  sampleRate: number;
  duration: number;
  qualityScore: number;
  cognitiveState: string;
  dominantBand: string;
  badChannels: string[];
  loadedAt: number;
}

export function loadCohortSummaries(): CohortSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCohortSummary(s: CohortSummary) {
  const existing = loadCohortSummaries().filter((e) => e.id !== s.id);
  existing.unshift(s);
  const trimmed = existing.slice(0, 100);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
}

export function clearCohort() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/* ---------- Cohort analysis ---------- */

/** Analyze a single recording from a text file (CSV/TSV/JSON). */
export async function analyzeFileForCohort(
  file: File,
  sampleRate: number
): Promise<CohortSubject> {
  const text = await file.text();
  const parsed = parseTextEEG(text, file.name, { sampleRate });
  const analysis = runAnalysis(parsed.data, parsed.channel_names, parsed.sampling_rate);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    fileName: file.name,
    channels: parsed.channels,
    sampleRate: parsed.sampling_rate,
    duration: parsed.duration_sec,
    channelNames: parsed.channel_names,
    analysis,
    data: parsed.data,
    anomalyScore: 0,
    anomalyBreakdown: [],
    source: "client-parsed",
    loadedAt: Date.now(),
  };
}

/**
 * Compute per-subject anomaly scores against cohort medians. The score is the
 * sum of |z-scores| across {quality, alpha share, beta share, gamma share,
 * bad-channel count}. Higher = more unusual.
 */
export function rankAnomalies(subjects: CohortSubject[]): CohortStats {
  if (subjects.length === 0) {
    return {
      subjects: [],
      medians: { quality: 0, dominantBandIndex: {}, alphaPeakHz: null, badChannelCount: 0 },
    };
  }

  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  };
  const mad = (xs: number[], m: number) => med(xs.map((v) => Math.abs(v - m))) || 1;

  const qualities = subjects.map((s) => s.analysis.quality.overall);
  const badCounts = subjects.map((s) => s.analysis.quality.badChannels.length);
  const alphaShare = subjects.map(
    (s) => s.analysis.avgBands.alpha / (s.analysis.avgBands.total || 1)
  );
  const gammaShare = subjects.map(
    (s) => s.analysis.avgBands.gamma / (s.analysis.avgBands.total || 1)
  );
  const peaks = subjects
    .map((s) => s.analysis.alphaPeakHz)
    .filter((x): x is number => x !== null);

  const medQ = med(qualities), madQ = mad(qualities, medQ);
  const medB = med(badCounts), madB = mad(badCounts, medB);
  const medA = med(alphaShare), madA = mad(alphaShare, medA);
  const medG = med(gammaShare), madG = mad(gammaShare, medG);

  const subjectsScored = subjects.map((s) => {
    const a = s.analysis.avgBands.alpha / (s.analysis.avgBands.total || 1);
    const g = s.analysis.avgBands.gamma / (s.analysis.avgBands.total || 1);
    const zq = Math.abs((s.analysis.quality.overall - medQ) / (1.4826 * madQ));
    const zb = Math.abs((s.analysis.quality.badChannels.length - medB) / (1.4826 * madB));
    const za = Math.abs((a - medA) / (1.4826 * madA));
    const zg = Math.abs((g - medG) / (1.4826 * madG));
    const total = zq + zb + za + zg;
    return {
      ...s,
      anomalyScore: total,
      anomalyBreakdown: [
        { name: "quality", z: zq },
        { name: "bad channels", z: zb },
        { name: "alpha share", z: za },
        { name: "gamma share", z: zg },
      ],
    };
  });

  return {
    subjects: subjectsScored.sort((a, b) => b.anomalyScore - a.anomalyScore),
    medians: {
      quality: medQ,
      dominantBandIndex: subjects.reduce(
        (acc, s) => {
          acc[s.analysis.dominantBand] = (acc[s.analysis.dominantBand] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      alphaPeakHz: peaks.length ? med(peaks) : null,
      badChannelCount: medB,
    },
  };
}
