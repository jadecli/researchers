import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Shell } from "./shell";
import "./globals.css";

const geistSans = localFont({
  src: "../../public/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../../public/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentTasks",
  description: "Data-driven task orchestration for AI agents",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141413",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-[#141413] text-[#faf9f5]">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
