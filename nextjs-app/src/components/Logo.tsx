import React from "react";

interface Props {
  className?: string;
}

export default function Logo({ className = "h-6 w-6" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      {/* Simple, calm: a brainwave glyph inside a rounded square */}
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M4.5 12 L7.5 12 L9 7.5 L11.5 17 L13.5 10 L15.5 14 L17 12 L19.5 12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
