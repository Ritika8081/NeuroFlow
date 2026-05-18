import React from "react";

/**
 * Subtle EEG-wave illustration for the hero. Pure SVG — no animation by default
 * (one strand flows slowly for life).
 */
export default function DecorativeWave() {
  return (
    <div className="relative aspect-[4/3] w-full">
      {/* Soft halo */}
      <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[rgb(var(--accent)/0.10)] via-transparent to-[rgb(var(--coral)/0.06)]" />

      <svg
        viewBox="0 0 400 300"
        className="w-full h-full"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="strokeAccent" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0" />
            <stop offset="0.15" stopColor="rgb(var(--accent))" stopOpacity="0.6" />
            <stop offset="0.85" stopColor="rgb(var(--accent))" stopOpacity="0.8" />
            <stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="strokeMuted" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(var(--muted))" stopOpacity="0" />
            <stop offset="0.5" stopColor="rgb(var(--muted))" stopOpacity="0.4" />
            <stop offset="1" stopColor="rgb(var(--muted))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="strokeCoral" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(var(--coral))" stopOpacity="0" />
            <stop offset="0.5" stopColor="rgb(var(--coral))" stopOpacity="0.55" />
            <stop offset="1" stopColor="rgb(var(--coral))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Several EEG-style waves layered, alpha + low amplitude */}
        <path
          d="M 0 60 Q 25 40, 50 60 T 100 60 T 150 60 T 200 60 T 250 60 T 300 60 T 350 60 T 400 60"
          stroke="url(#strokeMuted)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 0 110 Q 20 90, 40 105 T 80 100 Q 100 80, 120 100 T 160 105 Q 180 90, 200 105 T 240 100 Q 260 80, 280 100 T 320 105 Q 340 90, 360 105 T 400 100"
          stroke="url(#strokeAccent)"
          strokeWidth="1.4"
          fill="none"
          className="wave-flow"
        />
        <path
          d="M 0 160 Q 25 135, 50 160 T 100 145 Q 125 175, 150 150 T 200 160 T 250 145 Q 275 175, 300 150 T 350 160 T 400 150"
          stroke="url(#strokeMuted)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 0 210 Q 30 180, 60 210 T 120 200 Q 150 230, 180 200 T 240 210 Q 270 180, 300 210 T 360 200 T 400 210"
          stroke="url(#strokeCoral)"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M 0 260 Q 25 240, 50 260 T 100 260 T 150 260 T 200 260 T 250 260 T 300 260 T 350 260 T 400 260"
          stroke="url(#strokeMuted)"
          strokeWidth="1"
          fill="none"
        />

        {/* Subtle dots representing electrode positions */}
        {[
          [60, 60], [180, 60], [320, 60],
          [100, 160], [260, 160],
          [80, 210], [200, 260], [340, 210],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={2}
            fill="rgb(var(--accent))"
            opacity={0.45}
          />
        ))}
      </svg>
    </div>
  );
}
