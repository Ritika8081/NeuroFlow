import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";
import EEGDataProvider from "./context/EEGDataContext";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "NeuroFlow Lab — EEG Research Tool",
  description: "Upload, clean, and visualize EEG data with context-driven filter presets. Load PhysioNet datasets or upload your own.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans antialiased min-h-screen`} style={{ backgroundColor: "#f0f9ff", color: "#0c4a6e" }}>
        <EEGDataProvider>
          <Nav />
          {children}
        </EEGDataProvider>
      </body>
    </html>
  );
}
