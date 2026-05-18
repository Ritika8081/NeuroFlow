/**
 * Singleton wrapper around the analysis Web Worker.
 * Falls back to synchronous analysis when Workers are unavailable
 * (server-side rendering, very old browsers).
 */

import { AnalysisBundle, runAnalysis } from "./insights";

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<string, (msg: any) => void>();

function ensureWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../workers/analysis.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", (e: MessageEvent) => {
      const { id } = e.data;
      const resolver = pending.get(id);
      if (resolver) {
        resolver(e.data);
        pending.delete(id);
      }
    });
    worker.addEventListener("error", () => {
      // Reject all pending on fatal error
      for (const [, resolver] of pending) resolver({ ok: false, error: "Worker error" });
      pending.clear();
      worker = null;
    });
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

/**
 * Run analysis in the worker (preferred) or on the main thread (fallback).
 * Returns a Promise so callers can await.
 */
export async function runAnalysisAsync(
  data: number[][],
  channelNames: string[],
  sampleRate: number
): Promise<AnalysisBundle> {
  const w = ensureWorker();
  if (!w) {
    return runAnalysis(data, channelNames, sampleRate);
  }
  return new Promise<AnalysisBundle>((resolve, reject) => {
    const id = String(++nextId);
    pending.set(id, (msg) => {
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error || "Worker failed"));
    });
    try {
      w.postMessage({ id, type: "analyze", data, channelNames, sampleRate });
    } catch (e) {
      pending.delete(id);
      // Fallback to sync on postMessage failure
      try {
        resolve(runAnalysis(data, channelNames, sampleRate));
      } catch (err: any) {
        reject(err);
      }
    }
  });
}
