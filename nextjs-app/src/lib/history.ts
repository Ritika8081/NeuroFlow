/**
 * Lightweight session history persisted to localStorage. Stores recording
 * summaries (not raw data — too big) so users can revisit prior analyses.
 */

export interface HistoryEntry {
  id: string;
  fileName: string;
  channels: number;
  sampleRate: number;
  duration: number;
  channelNames: string[];
  uploadedAt: number;
  cognitiveState?: string;
  dominantBand?: string;
  qualityScore?: number;
  isSample?: boolean;
}

const KEY = "nfl-history";
const LIMIT = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  const existing = loadHistory().filter((e) => e.id !== entry.id);
  existing.unshift(entry);
  const trimmed = existing.slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // quota exceeded — silently drop the entry
  }
}

export function deleteHistoryEntry(id: string) {
  const existing = loadHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(existing));
  } catch {}
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
