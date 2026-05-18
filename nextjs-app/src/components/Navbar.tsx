"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { useTheme } from "./ThemeProvider";
import { useAI } from "./AIProvider";
import AISettingsModal from "./AISettingsModal";
import Logo from "./Logo";

const NAV = [
  { href: "/", label: "Lab" },
  { href: "/docs", label: "Docs" },
  { href: "/help", label: "Help" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { active, configured, config } = useAI();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const isLocal = config.activeProvider === "local";

  return (
    <header className="sticky top-0 z-40 w-full bg-[rgb(var(--bg))]/85 backdrop-blur-md border-b">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <span className="inline-flex h-7 w-7 rounded-lg bg-gradient-to-br from-[rgb(var(--accent))]/15 to-[rgb(var(--coral))]/10 border border-[rgb(var(--accent))]/25 items-center justify-center group-hover:border-[rgb(var(--accent))]/50 transition-colors">
            <Logo className="h-3.5 w-3.5 text-[rgb(var(--accent-fg))]" />
          </span>
          <span className="font-semibold text-[15px] tracking-tight hidden xs:inline sm:inline">NeuroFlow Lab</span>
          <span className="font-semibold text-[15px] tracking-tight inline xs:hidden sm:hidden">NeuroFlow</span>
        </Link>

        {/* Nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? "text-[rgb(var(--accent-fg))] bg-[rgb(var(--accent-bg))]"
                    : "text-[rgb(var(--text-soft))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AI provider — labeled pill */}
          <button
            onClick={() => setAiOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-2))] hover:border-[rgb(var(--border-strong))] text-xs font-medium transition"
            title={`AI provider: ${active.label}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isLocal ? "bg-[rgb(var(--subtle))]" : configured ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span>AI</span>
            <span className="text-[10px] text-[rgb(var(--muted))] hidden lg:inline">
              · {isLocal ? "offline" : active.label.split(" · ")[0]}
            </span>
          </button>

          {/* Theme toggle — labeled */}
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-2))] hover:border-[rgb(var(--border-strong))] text-xs font-medium transition"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
                </svg>
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* GitHub — icon only at all sizes, but always visible */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-2))] hover:border-[rgb(var(--border-strong))] text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] transition"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.88-1.37-3.88-1.37-.53-1.35-1.3-1.71-1.3-1.71-1.07-.73.08-.72.08-.72 1.18.08 1.8 1.21 1.8 1.21 1.04 1.79 2.74 1.27 3.41.97.11-.75.41-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.99 0 1.98.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.77.12 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.42.36.79 1.08.79 2.18v3.23c0 .31.21.67.8.56 4.57-1.52 7.86-5.83 7.86-10.91C23.5 5.73 18.27.5 12 .5z" />
            </svg>
          </a>

          {/* Mobile menu */}
          <button
            onClick={() => setOpen((p) => !p)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-2))] text-[rgb(var(--text))] transition"
          >
            {open ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <AISettingsModal open={aiOpen} onClose={() => setAiOpen(false)} />

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t bg-[rgb(var(--surface))] px-4 py-3 flex flex-col gap-1 animate-fade-up">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 rounded-md text-sm font-medium ${
                  active
                    ? "bg-[rgb(var(--accent-bg))] text-[rgb(var(--accent-fg))]"
                    : "text-[rgb(var(--text-soft))] hover:bg-[rgb(var(--surface-2))]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="border-t my-2" />
          <button
            onClick={() => { setAiOpen(true); setOpen(false); }}
            className="px-3 py-2.5 rounded-md text-sm text-left text-[rgb(var(--text-soft))] hover:bg-[rgb(var(--surface-2))] flex items-center justify-between"
          >
            <span>AI providers</span>
            <span className="text-xs text-[rgb(var(--muted))]">
              {isLocal ? "offline" : active.label.split(" · ")[0]}
            </span>
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2.5 rounded-md text-sm text-[rgb(var(--text-soft))] hover:bg-[rgb(var(--surface-2))]"
          >
            GitHub ↗
          </a>
        </div>
      )}
    </header>
  );
}
