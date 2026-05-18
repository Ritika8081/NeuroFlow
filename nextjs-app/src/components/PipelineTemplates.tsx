"use client";

import React, { useState } from "react";
import {
  addTemplate,
  deleteTemplate,
  exportTemplate,
  importTemplate,
  loadTemplates,
  PipelineTemplate,
} from "../lib/templates";

interface Props {
  current: PipelineTemplate["filters"];
  currentUseCase?: string;
  onApply: (t: PipelineTemplate) => void;
}

export default function PipelineTemplates({ current, currentUseCase, onApply }: Props) {
  const [items, setItems] = useState<PipelineTemplate[]>(() => loadTemplates());
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);

  const refresh = () => setItems(loadTemplates());

  const save = () => {
    if (!name.trim()) return;
    addTemplate({
      name: name.trim(),
      description: desc.trim() || undefined,
      useCase: currentUseCase,
      filters: current,
    });
    setName("");
    setDesc("");
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    refresh();
  };

  const handleExport = (t: PipelineTemplate) => {
    const blob = new Blob([exportTemplate(t)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.name.replace(/\W+/g, "-")}.template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const t = importTemplate(importText);
    if (t) {
      setImportText("");
      setShowImport(false);
      refresh();
    }
  };

  const builtins = items.filter((t) => t.isBuiltIn);
  const custom = items.filter((t) => !t.isBuiltIn);

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Reusable pipelines</div>
        <h3 className="font-medium mt-1">Pipeline templates</h3>
        <p className="text-sm text-[rgb(var(--muted))] mt-1">
          Save your filter chain as a template you can apply to other recordings — yours, or shared as a JSON file.
        </p>
      </div>

      {/* Save current */}
      <div className="surface rounded-xl p-4 space-y-3">
        <div className="eyebrow">Save current</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="input"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="input"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={!name.trim()} className="btn btn-primary text-sm">
            Save template
          </button>
          <button onClick={() => setShowImport((p) => !p)} className="btn btn-secondary text-xs">
            {showImport ? "Cancel import" : "Import from JSON"}
          </button>
          <span className="text-[10px] text-[rgb(var(--muted))] mono ml-auto">
            BP {current.bandpass_low}-{current.bandpass_high} · notch {current.notch_freq} Hz
          </span>
        </div>
        {showImport && (
          <div className="space-y-2 animate-fade-up">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste exported template JSON…"
              rows={5}
              className="input font-mono text-xs"
            />
            <button onClick={handleImport} className="btn btn-secondary text-xs">
              Import
            </button>
          </div>
        )}
      </div>

      {/* Built-ins */}
      <div>
        <div className="eyebrow mb-2">Built-in</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {builtins.map((t) => (
            <TemplateCard key={t.id} t={t} onApply={onApply} onExport={handleExport} />
          ))}
        </div>
      </div>

      {/* Custom */}
      <div>
        <div className="eyebrow mb-2">Your templates ({custom.length})</div>
        {custom.length === 0 ? (
          <div className="surface rounded-xl p-5 text-sm text-[rgb(var(--muted))] text-center">
            No custom templates yet. Save the current filter chain above to make one.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {custom.map((t) => (
              <TemplateCard
                key={t.id}
                t={t}
                onApply={onApply}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  t,
  onApply,
  onDelete,
  onExport,
}: {
  t: PipelineTemplate;
  onApply: (t: PipelineTemplate) => void;
  onDelete?: (id: string) => void;
  onExport: (t: PipelineTemplate) => void;
}) {
  return (
    <div className="surface rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{t.name}</div>
          {t.description && (
            <div className="text-xs text-[rgb(var(--muted))] mt-0.5 line-clamp-2">{t.description}</div>
          )}
        </div>
        {t.isBuiltIn && <span className="chip-accent chip">built-in</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] mono text-[rgb(var(--muted))]">
        <span className="chip">BP {t.filters.bandpass_low}-{t.filters.bandpass_high}</span>
        <span className="chip">Notch {t.filters.notch_freq}</span>
        {t.filters.highpass_freq != null && <span className="chip">HP {t.filters.highpass_freq}</span>}
        {t.filters.lowpass_freq != null && <span className="chip">LP {t.filters.lowpass_freq}</span>}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <button onClick={() => onApply(t)} className="btn btn-secondary text-xs">Apply</button>
        <button onClick={() => onExport(t)} className="btn btn-ghost text-xs">Export</button>
        {onDelete && (
          <button onClick={() => onDelete(t.id)} className="btn btn-ghost text-xs ml-auto text-rose-500">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
