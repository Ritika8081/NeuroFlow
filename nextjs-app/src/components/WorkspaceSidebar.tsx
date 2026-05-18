"use client";

import React from "react";

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  group?: string;
}

interface Props {
  items: SidebarItem[];
  active: string;
  onChange: (id: string) => void;
}

export default function WorkspaceSidebar({ items, active, onChange }: Props) {
  const grouped: Record<string, SidebarItem[]> = {};
  for (const item of items) {
    const g = item.group ?? "Views";
    grouped[g] = grouped[g] ?? [];
    grouped[g].push(item);
  }

  return (
    <>
      {/* Mobile tabs */}
      <div className="lg:hidden mb-4 -mx-5 sm:-mx-8 px-5 sm:px-8 pb-3 border-b overflow-x-auto">
        <div className="flex gap-1">
          {items.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "text-[rgb(var(--accent-fg))] bg-[rgb(var(--accent-bg))]"
                    : "text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
                }`}
              >
                <span className={isActive ? "text-[rgb(var(--accent))]" : ""}>{t.icon}</span>
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span
                    className={`text-[10px] mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-[rgb(var(--accent)/0.18)] text-[rgb(var(--accent-fg))]"
                        : "bg-[rgb(var(--surface-3))]"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 sticky top-20 self-start h-fit">
        {Object.entries(grouped).map(([groupName, list]) => (
          <div key={groupName} className="mb-4">
            <div className="eyebrow text-[10px] mb-1.5 px-2">{groupName}</div>
            <div className="space-y-0.5">
              {list.map((t) => {
                const isActive = t.id === active;
                return (
                  <button
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    className={`group relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? "text-[rgb(var(--accent-fg))] bg-[rgb(var(--accent-bg))]"
                        : "text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[rgb(var(--accent))]" />
                    )}
                    <span className={`shrink-0 ${isActive ? "text-[rgb(var(--accent))]" : ""}`}>{t.icon}</span>
                    <span className="flex-1 text-left">{t.label}</span>
                    {t.badge !== undefined && (
                      <span
                        className={`mono text-[10px] px-1.5 py-0.5 rounded ${
                          isActive
                            ? "bg-[rgb(var(--accent)/0.18)] text-[rgb(var(--accent-fg))]"
                            : "bg-[rgb(var(--surface-3))] text-[rgb(var(--muted))]"
                        }`}
                      >
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </aside>
    </>
  );
}
