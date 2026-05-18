"use client";

import React, { useState } from "react";
import { buildBIDS, packZip, BIDSExportInput } from "../lib/bids";

interface Props {
  data: BIDSExportInput;
}

export default function BIDSExport({ data }: Props) {
  const [subjectId, setSubjectId] = useState(data.subjectId ?? "");
  const [sessionId, setSessionId] = useState(data.sessionId ?? "01");
  const [taskName, setTaskName] = useState(data.taskName ?? "rest");
  const [busy, setBusy] = useState(false);

  const downloadZip = async () => {
    setBusy(true);
    try {
      const bundle = buildBIDS({
        ...data,
        subjectId: subjectId || undefined,
        sessionId: sessionId || undefined,
        taskName: taskName || undefined,
      });
      // Use built-in zip packer (small, no deps)
      const bytes = packZip(bundle);
      const arrBuf = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([arrBuf], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bundle.rootName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="eyebrow">Standard format</div>
          <h3 className="font-medium mt-1">BIDS-EEG export</h3>
          <p className="text-sm text-[rgb(var(--muted))] mt-1 max-w-md">
            Pack the cleaned recording into a Brain Imaging Data Structure bundle —
            `dataset_description.json`, `channels.tsv`, `events.tsv`, sidecar JSON, and
            tab-delimited EEG. Ready to upload to OpenNeuro or feed to mne-bids.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-[11px] text-[rgb(var(--muted))] block mb-1.5">Subject ID</label>
          <input
            type="text"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            placeholder="auto"
            className="input"
          />
        </div>
        <div>
          <label className="text-[11px] text-[rgb(var(--muted))] block mb-1.5">Session</label>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="01"
            className="input"
          />
        </div>
        <div>
          <label className="text-[11px] text-[rgb(var(--muted))] block mb-1.5">Task</label>
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="rest"
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={downloadZip} disabled={busy} className="btn btn-primary text-sm">
          {busy ? "Packing…" : "Download BIDS bundle (.zip)"}
        </button>
        <a
          href="https://bids-standard.github.io/bids-validator/"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost text-xs"
        >
          Open BIDS validator ↗
        </a>
      </div>

      <div className="mt-4 text-[11px] text-[rgb(var(--muted))] leading-relaxed">
        Note: BIDS-EEG strictly expects binary formats (EDF / BDF / BrainVision / EEGLAB .set). We emit
        TSV alongside the sidecar — easily converted via <span className="mono">mne-bids</span>,
        <span className="mono"> pybv</span>, or <span className="mono">eeglabio</span>.
      </div>
    </div>
  );
}
