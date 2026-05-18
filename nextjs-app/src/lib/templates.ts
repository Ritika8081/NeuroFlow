/**
 * Pipeline templates — saved combinations of filters + context that users can
 * reuse across recordings. localStorage-backed; import/export as JSON.
 */

export interface PipelineTemplate {
  id: string;
  name: string;
  description?: string;
  useCase?: string;
  filters: {
    bandpass_low: number;
    bandpass_high: number;
    notch_freq: number;
    highpass_freq: number | null;
    lowpass_freq: number | null;
  };
  excludeChannels?: string[];
  createdAt: number;
  isBuiltIn?: boolean;
}

const KEY = "nfl-templates-v1";

/** Built-in starter templates so users have something to compare against. */
export const BUILTIN_TEMPLATES: PipelineTemplate[] = [
  {
    id: "builtin-resting",
    name: "Resting state · adult",
    description: "Standard awake resting EEG. 1–45 Hz, 50 Hz notch.",
    useCase: "Resting-state EEG",
    filters: { bandpass_low: 1, bandpass_high: 45, notch_freq: 50, highpass_freq: 0.5, lowpass_freq: 45 },
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: "builtin-sleep",
    name: "Sleep · whole night",
    description: "Preserves slow waves and spindles. 0.3–35 Hz.",
    useCase: "Sleep / overnight EEG",
    filters: { bandpass_low: 0.3, bandpass_high: 35, notch_freq: 50, highpass_freq: 0.3, lowpass_freq: 35 },
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: "builtin-erp",
    name: "Cognitive · ERP",
    description: "0.5–40 Hz, preserves slow ERP components.",
    useCase: "Cognitive / task-based EEG",
    filters: { bandpass_low: 0.5, bandpass_high: 40, notch_freq: 50, highpass_freq: 0.5, lowpass_freq: 40 },
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: "builtin-bci-mi",
    name: "BCI · motor imagery",
    description: "8–30 Hz to isolate µ and β rhythms.",
    useCase: "BCI / neurofeedback",
    filters: { bandpass_low: 8, bandpass_high: 30, notch_freq: 50, highpass_freq: 8, lowpass_freq: 30 },
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: "builtin-bci-p300",
    name: "BCI · P300 speller",
    description: "0.5–20 Hz to capture the P300 wave cleanly.",
    useCase: "BCI / neurofeedback",
    filters: { bandpass_low: 0.5, bandpass_high: 20, notch_freq: 50, highpass_freq: 0.5, lowpass_freq: 20 },
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: "builtin-consumer",
    name: "Consumer device",
    description: "Conservative for Muse / Emotiv / OpenBCI. 1–40 Hz, 60 Hz notch.",
    useCase: "Low-cost device",
    filters: { bandpass_low: 1, bandpass_high: 40, notch_freq: 60, highpass_freq: 1, lowpass_freq: 40 },
    createdAt: 0,
    isBuiltIn: true,
  },
];

export function loadTemplates(): PipelineTemplate[] {
  if (typeof window === "undefined") return BUILTIN_TEMPLATES;
  try {
    const raw = localStorage.getItem(KEY);
    const custom: PipelineTemplate[] = raw ? JSON.parse(raw) : [];
    return [...BUILTIN_TEMPLATES, ...custom];
  } catch {
    return BUILTIN_TEMPLATES;
  }
}

export function saveCustomTemplates(items: PipelineTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

export function addTemplate(t: Omit<PipelineTemplate, "id" | "createdAt">): PipelineTemplate {
  const tpl: PipelineTemplate = {
    ...t,
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const all = loadTemplates().filter((x) => !x.isBuiltIn);
  saveCustomTemplates([...all, tpl]);
  return tpl;
}

export function deleteTemplate(id: string) {
  const all = loadTemplates().filter((x) => !x.isBuiltIn && x.id !== id);
  saveCustomTemplates(all);
}

export function exportTemplate(t: PipelineTemplate): string {
  return JSON.stringify({ schema: "nfl-template/0.1", ...t }, null, 2);
}

export function importTemplate(text: string): PipelineTemplate | null {
  try {
    const obj = JSON.parse(text);
    if (!obj || !obj.filters || !obj.name) return null;
    return addTemplate({
      name: obj.name,
      description: obj.description,
      useCase: obj.useCase,
      filters: obj.filters,
      excludeChannels: obj.excludeChannels,
    });
  } catch {
    return null;
  }
}
