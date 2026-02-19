"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/compare", label: "Compare" },
  { href: "/docs", label: "Docs" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header
        style={{
        background: "#fff",
        boxShadow: "0 2px 12px rgba(14, 165, 233, 0.1)",
        borderRadius: 16,
        margin: "12px 24px",
        marginTop: 12,
        marginBottom: 0,
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-8 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between" style={{ minHeight: 72 }}>
          <Link
            href="/"
            className="flex items-center gap-3 no-underline"
            style={{ textDecoration: "none", paddingLeft: 20 }}
          >
            <span
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "white",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              EEG
            </span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#0369a1", letterSpacing: "-0.02em" }}>NeuroFlow Lab</h3>
          </Link>
          <nav className="flex items-center" style={{ gap: 32, paddingRight: 20 }}>
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium transition-all rounded-xl"
                style={{
                  textDecoration: "none",
                  padding: "10px 20px",
                  borderRadius: 12,
                  backgroundColor: pathname === href ? "#e0f2fe" : "transparent",
                  color: pathname === href ? "#0284c7" : "#64748b",
                }}
                onMouseEnter={(e) => {
                  if (pathname !== href) {
                    e.currentTarget.style.backgroundColor = "#f0f9ff";
                    e.currentTarget.style.color = "#0369a1";
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== href) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#64748b";
                  }
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
