"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useEEGData } from "@/app/context/EEGDataContext";
import { runCompare, runCompareMulti } from "@/lib/api";

const tableStyle = {
  section: { borderRadius: 20, border: "1px solid #e0f2fe", backgroundColor: "#fff", overflow: "hidden", boxShadow: "0 4px 20px -5px rgba(14, 165, 233, 0.12)" },
  header: { padding: "16px 20px", borderBottom: "1px solid #e0f2fe", backgroundColor: "#f0f9ff" },
  th: { padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0369a1", textAlign: "left" },
  thRight: { padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0369a1", textAlign: "right" },
  td: { padding: "10px 14px", fontSize: 13 },
};

export default function ComparePage() {
  const { source, subject, uploadedFileName, eegData } = useEEGData();
  const datasetFromHome = useMemo(() => {
    if (source === "physionet" && subject != null) return `PhysioNet Subject ${subject}`;
    if (source === "upload" && uploadedFileName) return uploadedFileName;
    return null;
  }, [source, subject, uploadedFileName]);

  const [pipelineA, setPipelineA] = useState("CSP + LDA");
  const [pipelineB, setPipelineB] = useState("Riemannian + MDM");
  const [numSubjects, setNumSubjects] = useState(1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const hasHomeData = !!eegData?.data && eegData.data.length > 0;
  const isPhysioNet = source === "physionet" && subject != null;
  const subjectLabel = isPhysioNet ? `S${String(subject).padStart(2, "0")}` : "Current";

  const handleCopyAtoB = () => setPipelineB(pipelineA);
  const canRunCompare = hasHomeData || (isPhysioNet && numSubjects > 1);
  const handleRunLOSO = useCallback(async () => {
    if (!canRunCompare) return;
    setRunning(true);
    setError(null);
    try {
      let res;
      if (isPhysioNet && numSubjects > 1) {
        res = await runCompareMulti(subject, numSubjects, pipelineA, pipelineB);
      } else if (hasHomeData) {
        res = await runCompare(
          eegData.data,
          eegData.sampling_rate || 160,
          pipelineA,
          pipelineB,
          subjectLabel
        );
      } else {
        return;
      }
      setResults(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [canRunCompare, hasHomeData, isPhysioNet, eegData, subject, numSubjects, pipelineA, pipelineB, subjectLabel]);

  const tableA = results?.tableA ?? [];
  const tableB = results?.tableB ?? [];
  const stats = results?.stats ?? {};
  const showResults = results && tableA.length > 0 && tableB.length > 0;

  const meanA = tableA.length ? {
    accuracy: tableA.reduce((s, r) => s + r.accuracy, 0) / tableA.length,
    balancedAcc: tableA.reduce((s, r) => s + r.balancedAcc, 0) / tableA.length,
    rocAuc: tableA.reduce((s, r) => s + r.rocAuc, 0) / tableA.length,
    kappa: tableA.reduce((s, r) => s + r.kappa, 0) / tableA.length,
    f1: tableA.reduce((s, r) => s + r.f1, 0) / tableA.length,
    itr: tableA.reduce((s, r) => s + r.itr, 0) / tableA.length,
  } : null;
  const meanB = tableB.length ? {
    accuracy: tableB.reduce((s, r) => s + r.accuracy, 0) / tableB.length,
    balancedAcc: tableB.reduce((s, r) => s + r.balancedAcc, 0) / tableB.length,
    rocAuc: tableB.reduce((s, r) => s + r.rocAuc, 0) / tableB.length,
    kappa: tableB.reduce((s, r) => s + r.kappa, 0) / tableB.length,
    f1: tableB.reduce((s, r) => s + r.f1, 0) / tableB.length,
    itr: tableB.reduce((s, r) => s + r.itr, 0) / tableB.length,
  } : null;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="mb-8">
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0c4a6e", letterSpacing: "-0.02em" }}>Pipeline A vs B Comparison</h1>
        <p style={{ color: "#64748b", marginTop: 8, fontSize: 15, lineHeight: 1.6 }}>
          Load data on Home first, then click Start Compare. Uses only your loaded data (PhysioNet or upload).
          {datasetFromHome && <span className="block mt-2 text-sm font-medium text-teal-600">Data from Home: {datasetFromHome}</span>}
        </p>
      </div>

      {/* Configuration — same design as Home page */}
      <section
        style={{
          borderRadius: 20,
          backgroundColor: "#fff",
          boxShadow: "0 4px 20px -5px rgba(14, 165, 233, 0.12)",
          border: "1px solid #e0f2fe",
          overflow: "hidden",
          marginBottom: 32,
        }}
      >
        <div style={{ padding: "24px 24px 28px" }} className="sm:px-10">
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em", marginBottom: 20 }}>CONFIGURATION</h2>
          <div className="flex flex-wrap items-end" style={{ gap: "20px 28px" }}>
            <div className="flex flex-col shrink-0">
              <label style={{ fontSize: 12, fontWeight: 500, color: "#0369a1", marginBottom: 8 }}>Dataset</label>
              <span
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  backgroundColor: datasetFromHome ? "#f0f9ff" : "#f8fafc",
                  color: datasetFromHome ? "#0369a1" : "#64748b",
                  fontSize: 13,
                  border: datasetFromHome ? "1px solid #bae6fd" : "2px dashed #cbd5e1",
                  display: "inline-block",
                  minWidth: 180,
                }}
              >
                {datasetFromHome || "— Load data on Home first —"}
              </span>
            </div>
            <div className="flex flex-col flex-1 min-w-[120px] sm:min-w-[140px]" style={{ maxWidth: 200 }}>
              <label className="block text-xs font-medium shrink-0" style={{ color: "#0369a1", marginBottom: 8 }}>Pipeline A</label>
              <select
                value={pipelineA}
                onChange={(e) => setPipelineA(e.target.value)}
                className="select-context w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                style={{ width: "100%" }}
              >
                <option>CSP + LDA</option>
                <option>Riemannian + MDM</option>
                <option>Filter-bank + EEGNet</option>
                <option>CSP + SVM</option>
              </select>
            </div>
            <div className="flex flex-col flex-1 min-w-[120px] sm:min-w-[140px]" style={{ maxWidth: 200 }}>
              <label className="block text-xs font-medium shrink-0" style={{ color: "#0369a1", marginBottom: 8 }}>Pipeline B</label>
              <select
                value={pipelineB}
                onChange={(e) => setPipelineB(e.target.value)}
                className="select-context w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                style={{ width: "100%" }}
              >
                <option>CSP + LDA</option>
                <option>Riemannian + MDM</option>
                <option>Filter-bank + EEGNet</option>
                <option>CSP + SVM</option>
              </select>
            </div>
            {isPhysioNet && (
              <div className="flex flex-col flex-1 min-w-[100px] sm:min-w-[120px]" style={{ maxWidth: 140 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <label className="text-xs font-medium shrink-0" style={{ color: "#0369a1" }}>Subjects</label>
                  <span style={{ fontSize: 11, color: "#64748b" }}>S{String(subject).padStart(2, "0")} onward</span>
                </div>
                <select
                  value={numSubjects}
                  onChange={(e) => setNumSubjects(Number(e.target.value))}
                  className="select-context w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                  style={{ width: "100%" }}
                >
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={9}>9</option>
                </select>
              </div>
            )}
            <button
              onClick={handleCopyAtoB}
              style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "#0284c7", backgroundColor: "#e0f2fe", border: "none", cursor: "pointer" }}
            >
              Copy A → B
            </button>
            <button
              onClick={handleRunLOSO}
              disabled={running || !canRunCompare}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                backgroundColor: "#0284c7",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: (running || !hasHomeData) ? "not-allowed" : "pointer",
                opacity: (running || !canRunCompare) ? 0.6 : 1,
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
              }}
            >
              {running ? "Comparing…" : canRunCompare ? "Start Compare" : "Load data on Home first"}
            </button>
          </div>
          <p className="mt-4 text-xs" style={{ color: "#64748b" }}>
            {canRunCompare ? "PhysioNet: increase Subjects to compare multiple. Upload: uses your file." : "Load data on the Home page first (PhysioNet or upload), then run the comparison."}
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </section>

      {/* Tables — only show after Start Compare with Home data */}
      {showResults && (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Table A */}
        <section style={tableStyle.section}>
          <div style={tableStyle.header}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0369a1" }}>Table A — {pipelineA}</h2>
          </div>
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-sm" style={{ minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e0f2fe", backgroundColor: "#f0f9ff" }}>
                  <th style={{ ...tableStyle.th, minWidth: 70 }}>Subject</th>
                  <th style={{ ...tableStyle.thRight }}>Acc %</th>
                  <th style={{ ...tableStyle.thRight }}>Bal Acc</th>
                  <th style={{ ...tableStyle.thRight }}>ROC AUC</th>
                  <th style={{ ...tableStyle.thRight }}>Kappa</th>
                  <th style={{ ...tableStyle.thRight }}>F1</th>
                  <th style={{ ...tableStyle.thRight }}>ITR</th>
                </tr>
              </thead>
              <tbody>
                {tableA.map((row) => (
                  <tr key={row.subject} style={{ borderBottom: "1px solid #f0f9ff" }} className="hover:bg-sky-50/50">
                    <td style={{ ...tableStyle.td, fontFamily: "monospace", color: "#0c4a6e" }}>{row.subject}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.accuracy.toFixed(1)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.balancedAcc.toFixed(1)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.rocAuc.toFixed(2)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.kappa.toFixed(2)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.f1.toFixed(2)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.itr.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#e0f2fe", fontWeight: 600 }}>
                  <td style={{ padding: "12px 14px" }}>Mean</td>
                  {meanA && (
                    <>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanA.accuracy.toFixed(1)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanA.balancedAcc.toFixed(1)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanA.rocAuc.toFixed(2)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanA.kappa.toFixed(2)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanA.f1.toFixed(2)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanA.itr.toFixed(1)}</td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Table B */}
        <section style={tableStyle.section}>
          <div style={tableStyle.header}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0369a1" }}>Table B — {pipelineB}</h2>
          </div>
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-sm" style={{ minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e0f2fe", backgroundColor: "#f0f9ff" }}>
                  <th style={{ ...tableStyle.th, minWidth: 70 }}>Subject</th>
                  <th style={{ ...tableStyle.thRight }}>Acc %</th>
                  <th style={{ ...tableStyle.thRight }}>Bal Acc</th>
                  <th style={{ ...tableStyle.thRight }}>ROC AUC</th>
                  <th style={{ ...tableStyle.thRight }}>Kappa</th>
                  <th style={{ ...tableStyle.thRight }}>F1</th>
                  <th style={{ ...tableStyle.thRight }}>ITR</th>
                </tr>
              </thead>
              <tbody>
                {tableB.map((row) => (
                  <tr key={row.subject} style={{ borderBottom: "1px solid #f0f9ff" }} className="hover:bg-sky-50/50">
                    <td style={{ ...tableStyle.td, fontFamily: "monospace", color: "#0c4a6e" }}>{row.subject}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.accuracy.toFixed(1)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.balancedAcc.toFixed(1)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.rocAuc.toFixed(2)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.kappa.toFixed(2)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.f1.toFixed(2)}</td>
                    <td style={{ ...tableStyle.td, textAlign: "right" }}>{row.itr.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#e0f2fe", fontWeight: 600 }}>
                  <td style={{ padding: "12px 14px" }}>Mean</td>
                  {meanB && (
                    <>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanB.accuracy.toFixed(1)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanB.balancedAcc.toFixed(1)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanB.rocAuc.toFixed(2)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanB.kappa.toFixed(2)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanB.f1.toFixed(2)}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>{meanB.itr.toFixed(1)}</td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
      )}

      {/* Statistical comparison — only show after Start Compare */}
      {showResults && Object.keys(stats).length > 0 && (
      <section style={tableStyle.section}>
        <div style={{ ...tableStyle.header, padding: "20px 24px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0369a1" }}>Statistical Comparison</h2>
          <p className="text-xs mt-1" style={{ color: "#64748b" }}>Paired t-test & Wilcoxon signed-rank • α = 0.05</p>
        </div>
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e0f2fe", backgroundColor: "#f0f9ff" }}>
                <th style={{ ...tableStyle.th }}>Metric</th>
                <th style={{ ...tableStyle.thRight }}>Mean A</th>
                <th style={{ ...tableStyle.thRight }}>Mean B</th>
                <th style={{ ...tableStyle.thRight }}>Delta</th>
                <th style={{ ...tableStyle.thRight }}>p-value</th>
                <th style={{ ...tableStyle.thRight }}>Significant</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats).map(([metric, s]) => (
                <tr key={metric} style={{ borderBottom: "1px solid #f0f9ff" }} className="hover:bg-sky-50/50">
                  <td style={{ ...tableStyle.td, fontWeight: 600, color: "#0c4a6e" }}>{metric}</td>
                  <td style={{ ...tableStyle.td, textAlign: "right" }}>{s.meanA.toFixed(2)}</td>
                  <td style={{ ...tableStyle.td, textAlign: "right" }}>{s.meanB.toFixed(2)}</td>
                  <td style={{ ...tableStyle.td, textAlign: "right", color: s.delta >= 0 ? "#16a34a" : "#dc2626" }}>
                    {s.delta >= 0 ? "+" : ""}{s.delta.toFixed(2)}
                  </td>
                  <td style={{ ...tableStyle.td, textAlign: "right" }}>{s.pValue.toFixed(3)}</td>
                  <td style={{ ...tableStyle.td, textAlign: "right" }}>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      backgroundColor: s.significant ? "#dcfce7" : "#f1f5f9",
                      color: s.significant ? "#166534" : "#64748b",
                    }}>
                      {s.significant ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {!canRunCompare && (
        <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-zinc-600">Load data on the Home page first (PhysioNet or upload a file).</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800">
            Go to Home
          </Link>
        </section>
      )}

      {canRunCompare && !showResults && !running && (
        <section className="rounded-lg border border-zinc-200 bg-sky-50/50 p-8 text-center">
          <p className="text-zinc-700">Data loaded: <strong>{datasetFromHome}</strong></p>
          <p className="text-zinc-600 mt-2">Select pipelines and click Start Compare to run the comparison.</p>
        </section>
      )}

      <p className="mt-8">
        <Link href="/" style={{ color: "#0284c7", fontSize: 14, fontWeight: 500 }} className="hover:underline">
          ← Back to Single Subject
        </Link>
      </p>
    </main>
  );
}
