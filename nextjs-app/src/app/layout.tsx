import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { AIProvider } from "../components/AIProvider";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeuroFlow Lab",
  description:
    "A modern EEG analysis workspace. Upload, clean, and explore brainwave recordings with AI-assisted insights.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('nfl-theme');
                  if (t === 'light') { document.documentElement.classList.remove('dark'); }
                  else { document.documentElement.classList.add('dark'); }
                } catch (e) { document.documentElement.classList.add('dark'); }
              })();
            `,
          }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased min-h-screen flex flex-col`}>
        <ThemeProvider>
          <AIProvider>
            <Navbar />
            <div className="flex-1">{children}</div>
            <Footer />
          </AIProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
