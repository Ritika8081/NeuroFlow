/**
 * Web Worker that runs runAnalysis() off the main thread.
 *
 * Imports the same pure analysis pipeline used everywhere else.
 * Communication protocol:
 *   ←  { id, type: "analyze", data, channelNames, sampleRate }
 *   →  { id, ok: true, result: AnalysisBundle }
 *   →  { id, ok: false, error: string }
 */

import { runAnalysis } from "../lib/insights";

interface AnalyzeRequest {
  id: string;
  type: "analyze";
  data: number[][];
  channelNames: string[];
  sampleRate: number;
}

self.addEventListener("message", (e: MessageEvent<AnalyzeRequest>) => {
  const req = e.data;
  if (!req || req.type !== "analyze") return;
  try {
    const result = runAnalysis(req.data, req.channelNames, req.sampleRate);
    (self as unknown as Worker).postMessage({ id: req.id, ok: true, result });
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      id: req.id,
      ok: false,
      error: err?.message ?? String(err),
    });
  }
});

export {};
