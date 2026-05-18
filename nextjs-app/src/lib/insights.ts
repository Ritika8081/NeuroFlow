/**
 * Turns DSP numerical analysis into human-readable findings.
 * Heuristic, but grounded in EEG literature (frontal alpha asymmetry,
 * theta/beta as ADHD-linked, alpha 8-13 Hz as posterior dominant rhythm, etc.).
 */

import {
  BANDS,
  BAND_ORDER,
  BandName,
  CognitiveStateResult,
  QualityReport,
  classifyCognitiveState,
  computeBandPowers,
  detectArtifacts,
  frontalAlphaAsymmetry,
  qualityScore,
} from "./dsp";

export interface AnalysisBundle {
  perChannelBands: Array<Record<BandName, number> & { total: number; name: string }>;
  avgBands: Record<BandName, number> & { total: number };
  dominantBand: BandName;
  cognitive: CognitiveStateResult;
  quality: QualityReport;
  asymmetry: { value: number; interpretation: string } | null;
  findings: Finding[];
  alphaPeakHz: number | null;
}

export interface Finding {
  severity: "info" | "good" | "warn" | "danger";
  title: string;
  body: string;
  icon?: string;
}

export function runAnalysis(
  data: number[][],
  channelNames: string[],
  sampleRate: number
): AnalysisBundle {
  const perChannelBands: AnalysisBundle["perChannelBands"] = [];
  const avg: Record<BandName, number> = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
  let alphaPeakHz: number | null = null;
  let alphaPeakAmp = -Infinity;

  for (let i = 0; i < data.length; i++) {
    const { bands, psd } = computeBandPowers(data[i], sampleRate);
    perChannelBands.push({
      name: channelNames[i] || `Ch${i + 1}`,
      delta: bands.delta,
      theta: bands.theta,
      alpha: bands.alpha,
      beta: bands.beta,
      gamma: bands.gamma,
      total: bands.total,
    });
    for (const b of BAND_ORDER) avg[b] += bands[b];

    // estimate alpha peak (8-13 Hz) on posterior channels
    if (/^O|^P/i.test(channelNames[i] || "")) {
      for (let k = 0; k < psd.freqs.length; k++) {
        if (psd.freqs[k] >= BANDS.alpha[0] && psd.freqs[k] <= BANDS.alpha[1]) {
          if (psd.psd[k] > alphaPeakAmp) {
            alphaPeakAmp = psd.psd[k];
            alphaPeakHz = psd.freqs[k];
          }
        }
      }
    }
  }
  for (const b of BAND_ORDER) avg[b] /= Math.max(1, data.length);
  const total = BAND_ORDER.reduce((s, b) => s + avg[b], 0) || 1;
  const avgBands = { ...avg, total };

  let dominantBand: BandName = "alpha";
  let best = 0;
  for (const b of BAND_ORDER) {
    if (avg[b] > best) {
      best = avg[b];
      dominantBand = b;
    }
  }

  const cognitive = classifyCognitiveState(data, channelNames, sampleRate);
  const artifacts = detectArtifacts(data, channelNames, sampleRate);
  const quality = qualityScore(data, channelNames, sampleRate, artifacts);
  const asymmetry = frontalAlphaAsymmetry(data, channelNames, sampleRate);

  const findings: Finding[] = [];

  // dominant band finding
  const bandPct = (avg[dominantBand] / total) * 100;
  findings.push({
    severity: dominantBand === "alpha" ? "good" : "info",
    title: `Dominant rhythm: ${dominantBand.toUpperCase()} (${bandPct.toFixed(0)}% of spectrum)`,
    body:
      dominantBand === "alpha"
        ? "Posterior-dominant alpha is the textbook resting EEG signature for relaxed wakefulness with eyes closed."
        : dominantBand === "delta"
        ? "Predominant delta suggests deep sleep, sedation, or — in awake recordings — pathology or significant low-frequency drift."
        : dominantBand === "theta"
        ? "Elevated theta is associated with drowsiness, memory encoding, or meditation."
        : dominantBand === "beta"
        ? "Elevated beta indicates active cognition, anxiety, or contamination from EMG / movement."
        : "Predominant gamma in scalp EEG is rare and usually signals muscle artifact rather than neural activity.",
  });

  // alpha peak frequency
  if (alphaPeakHz) {
    const apf = alphaPeakHz.toFixed(1);
    findings.push({
      severity: alphaPeakHz < 8.5 ? "warn" : "info",
      title: `Alpha peak frequency: ${apf} Hz`,
      body:
        alphaPeakHz < 8.5
          ? "Slowed alpha (<8.5 Hz) can indicate fatigue, cognitive decline, or pathology. Cross-check against age norms."
          : alphaPeakHz > 11.5
          ? "Fast alpha (>11.5 Hz) is typical of younger adults and high cognitive performers."
          : "Within the typical adult range (9–11 Hz).",
    });
  }

  // cognitive state finding
  findings.push({
    severity: "info",
    title: `Likely cognitive state: ${cognitive.state}`,
    body:
      `Confidence ${(cognitive.confidence * 100).toFixed(0)}%. ` +
      stateBlurb(cognitive.state),
  });

  // asymmetry
  if (asymmetry) {
    findings.push({
      severity: "info",
      title: `Frontal alpha asymmetry: ${asymmetry.value.toFixed(2)}`,
      body: `${asymmetry.interpretation}. FAA is a research-grade affective valence proxy — interpret cautiously.`,
    });
  }

  // quality
  if (quality.overall >= 80) {
    findings.push({
      severity: "good",
      title: `Excellent recording quality (${quality.overall}/100)`,
      body: "Most samples are clean and channels look healthy. Safe to proceed to analysis.",
    });
  } else if (quality.overall >= 60) {
    findings.push({
      severity: "warn",
      title: `Acceptable quality (${quality.overall}/100)`,
      body: "Some artifacts and/or noisy channels. Consider tightening filters or excluding bad channels.",
    });
  } else {
    findings.push({
      severity: "danger",
      title: `Poor quality (${quality.overall}/100)`,
      body: "Heavy artifact load or several flat / bad channels. Re-record if possible, or apply aggressive cleaning before drawing conclusions.",
    });
  }

  // bad channels
  if (quality.badChannels.length > 0) {
    findings.push({
      severity: "warn",
      title: `Bad channels detected: ${quality.badChannels.join(", ")}`,
      body: "These channels appear flat or saturated. Exclude them from averaging and topographic plots.",
    });
  }

  // line noise
  const lineCount = artifacts.filter((a) => a.type === "line-noise").length;
  if (lineCount > 0) {
    findings.push({
      severity: "warn",
      title: `Mains interference in ${lineCount} segments`,
      body: "Strong 50/60 Hz peaks detected. Make sure the notch filter is enabled and matches your country's mains frequency.",
    });
  }

  // muscle
  const muscleCount = artifacts.filter((a) => a.type === "muscle").length;
  if (muscleCount > 0) {
    findings.push({
      severity: "warn",
      title: `Muscle artifact suspected in ${muscleCount} segments`,
      body: "High gamma power (>35% of total) is usually EMG, not brain. Lower the band-pass high cut-off or use ICA-based muscle removal.",
    });
  }

  // blinks
  const blinkCount = artifacts.filter((a) => a.type === "blink").length;
  if (blinkCount > 0) {
    findings.push({
      severity: "info",
      title: `~${blinkCount} blink-like events`,
      body: "Brief frontal high-amplitude deflections. ICA-based EOG removal will clean these reliably.",
    });
  }

  return {
    perChannelBands,
    avgBands,
    dominantBand,
    cognitive,
    quality,
    asymmetry,
    findings,
    alphaPeakHz,
  };
}

function stateBlurb(state: CognitiveStateResult["state"]) {
  switch (state) {
    case "focused":
      return "High engagement ratio with elevated beta — typical of active task performance or sustained attention.";
    case "relaxed":
      return "Posterior alpha is the dominant feature — characteristic of resting wakefulness with eyes closed.";
    case "drowsy":
      return "High theta-to-beta ratio is associated with reduced vigilance and impending sleep onset.";
    case "meditative":
      return "Mixed theta and alpha activity, sometimes called the 'theta-alpha' state seen in long-term meditators.";
    case "stressed":
      return "Excess fast activity (beta+gamma) can indicate cognitive load, anxiety, or simply muscle contamination — disambiguate using topography.";
    default:
      return "No dominant signature. The recording looks ordinary alert wakefulness.";
  }
}
