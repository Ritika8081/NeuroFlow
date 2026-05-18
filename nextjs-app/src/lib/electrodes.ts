/**
 * 10-20 (and selected 10-10) electrode positions projected onto a unit disc
 * centered at (0,0), nose-up. x: -1 (left) ... +1 (right), y: -1 (back) ... +1 (front).
 */

export interface Electrode {
  name: string;
  x: number;
  y: number;
}

const POS: Record<string, [number, number]> = {
  // frontopolar
  Fp1: [-0.27, 0.95],
  Fp2: [0.27, 0.95],
  // frontal
  AF3: [-0.32, 0.78],
  AF4: [0.32, 0.78],
  AF7: [-0.55, 0.78],
  AF8: [0.55, 0.78],
  Fz: [0, 0.6],
  F1: [-0.18, 0.62],
  F2: [0.18, 0.62],
  F3: [-0.38, 0.6],
  F4: [0.38, 0.6],
  F5: [-0.55, 0.55],
  F6: [0.55, 0.55],
  F7: [-0.72, 0.5],
  F8: [0.72, 0.5],
  // frontocentral
  FCz: [0, 0.32],
  FC1: [-0.2, 0.32],
  FC2: [0.2, 0.32],
  FC3: [-0.42, 0.32],
  FC4: [0.42, 0.32],
  FC5: [-0.62, 0.3],
  FC6: [0.62, 0.3],
  FT7: [-0.82, 0.25],
  FT8: [0.82, 0.25],
  // temporal & central
  T3: [-0.95, 0],
  T4: [0.95, 0],
  T7: [-0.95, 0],
  T8: [0.95, 0],
  Cz: [0, 0],
  C1: [-0.22, 0],
  C2: [0.22, 0],
  C3: [-0.45, 0],
  C4: [0.45, 0],
  C5: [-0.68, 0],
  C6: [0.68, 0],
  // centro-parietal
  CPz: [0, -0.3],
  CP1: [-0.2, -0.3],
  CP2: [0.2, -0.3],
  CP3: [-0.42, -0.3],
  CP4: [0.42, -0.3],
  CP5: [-0.62, -0.3],
  CP6: [0.62, -0.3],
  TP7: [-0.82, -0.25],
  TP8: [0.82, -0.25],
  T5: [-0.78, -0.55],
  T6: [0.78, -0.55],
  // parietal
  Pz: [0, -0.6],
  P1: [-0.18, -0.62],
  P2: [0.18, -0.62],
  P3: [-0.38, -0.6],
  P4: [0.38, -0.6],
  P5: [-0.55, -0.55],
  P6: [0.55, -0.55],
  P7: [-0.72, -0.5],
  P8: [0.72, -0.5],
  // parieto-occipital & occipital
  POz: [0, -0.78],
  PO3: [-0.32, -0.78],
  PO4: [0.32, -0.78],
  PO7: [-0.55, -0.78],
  PO8: [0.55, -0.78],
  Oz: [0, -0.95],
  O1: [-0.27, -0.95],
  O2: [0.27, -0.95],
  // mastoids / earlobes
  A1: [-1.05, -0.15],
  A2: [1.05, -0.15],
  M1: [-1.0, -0.4],
  M2: [1.0, -0.4],
};

export function lookupElectrode(name: string): Electrode | null {
  if (!name) return null;
  const key = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
  // try exact / case-insensitive
  for (const k of Object.keys(POS)) {
    if (k.toUpperCase() === key) return { name: k, x: POS[k][0], y: POS[k][1] };
  }
  // common synonyms
  const synonyms: Record<string, string> = {
    T3: "T7",
    T4: "T8",
    T5: "P7",
    T6: "P8",
    O9: "O1",
    O10: "O2",
  };
  const syn = synonyms[key];
  if (syn && POS[syn]) return { name: syn, x: POS[syn][0], y: POS[syn][1] };
  return null;
}

/** For an unknown channel list, lay them out evenly around an inner ring as a fallback. */
export function autoLayout(channelNames: string[]): Electrode[] {
  const known = channelNames.map((n) => lookupElectrode(n));
  const unknownIdx = known
    .map((e, i) => (e === null ? i : -1))
    .filter((i) => i >= 0);
  const out: Electrode[] = known.map((e, i) =>
    e ? e : { name: channelNames[i], x: 0, y: 0 }
  );
  unknownIdx.forEach((i, k) => {
    const total = unknownIdx.length;
    const angle = (k / total) * Math.PI * 2;
    out[i] = {
      name: channelNames[i],
      x: 0.6 * Math.cos(angle),
      y: 0.6 * Math.sin(angle),
    };
  });
  return out;
}
