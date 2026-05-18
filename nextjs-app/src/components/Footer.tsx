import React from "react";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Logo className="h-4 w-4 text-[rgb(var(--muted))]" />
          <span className="text-[rgb(var(--muted))]">NeuroFlow Lab</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
          <span>Local-first. No telemetry.</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
