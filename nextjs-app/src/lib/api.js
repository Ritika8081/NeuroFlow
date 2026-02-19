const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.error || res.statusText);
  }
  return res.json();
}

export async function health() {
  return fetchApi("/health");
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
}

export async function parseEeg(payload) {
  return fetchApi("/parse", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cleanEeg(payload) {
  return fetchApi("/clean", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loadPhysioNet(subject = 1, runs = [4, 8, 12], maxSamples = 8000) {
  return fetchApi("/datasets/physionet/load", {
    method: "POST",
    body: JSON.stringify({ subject, runs, max_samples: maxSamples }),
  });
}

export async function physioNetInfo() {
  return fetchApi("/datasets/physionet/info");
}

export async function bandPower(data, samplingRate) {
  return fetchApi("/bandpower", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
    }),
  });
}

export async function computePsd(data, samplingRate) {
  return fetchApi("/psd", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
    }),
  });
}

export async function computeTimeFreqSpectrogram(data, samplingRate, options = {}) {
  return fetchApi("/time-freq-spectrogram", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
      baseline_ratio: options.baseline_ratio ?? 0.2,
      freq_min: options.freq_min ?? 2,
      freq_max: options.freq_max ?? 80,
    }),
  });
}

export async function computeSpectralEntropy(data, samplingRate) {
  return fetchApi("/spectral-entropy", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
    }),
  });
}

export async function computeHjorth(data) {
  return fetchApi("/hjorth", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: 160, // not used by Hjorth
    }),
  });
}

export async function computeEegMetrics(data, samplingRate) {
  return fetchApi("/eeg-metrics", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
    }),
  });
}

export async function computeAiInsights(data, samplingRate) {
  return fetchApi("/ai-insights", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
    }),
  });
}

export async function applyPca(data, nComponents = 10) {
  return fetchApi("/pca", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      n_components: nComponents,
    }),
  });
}

export async function runCompare(data, samplingRate, pipelineA, pipelineB, subjectLabel = "S01") {
  return fetchApi("/compare", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
      pipeline_a: pipelineA,
      pipeline_b: pipelineB,
      subject_label: subjectLabel,
    }),
  });
}

export async function runCompareMulti(startSubject, numSubjects, pipelineA, pipelineB) {
  return fetchApi("/compare-multi", {
    method: "POST",
    body: JSON.stringify({
      source: "physionet",
      start_subject: startSubject,
      num_subjects: numSubjects,
      pipeline_a: pipelineA,
      pipeline_b: pipelineB,
    }),
  });
}

export async function applyIca(data, samplingRate, channelNames = [], exclude = []) {
  return fetchApi("/ica", {
    method: "POST",
    body: JSON.stringify({
      data: Array.isArray(data[0]) ? data : [data],
      sampling_rate: samplingRate,
      channel_names: channelNames,
      exclude,
    }),
  });
}
