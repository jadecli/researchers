import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
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
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#141413",
};

const NAV = [
  { label: "Overview", href: "/", icon: "◉" },
  { label: "Docs", href: "/what-are-tasks", icon: "?" },
  { label: "Spec", href: "/specification", icon: "⎕" },
  { label: "Pages", href: "/pages", icon: "◫" },
  { label: "Rounds", href: "/rounds", icon: "↻" },
  { label: "Tasks", href: "/tasks", icon: "☐" },
  { label: "Experiments", href: "/experiments", icon: "⚗" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-[#141413] text-[#faf9f5]">
        <div className="flex flex-col md:flex-row min-h-dvh">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-56 border-r border-[#2a2a28] p-5 flex-col gap-1 fixed h-full">
            <Link href="/" className="text-base font-bold text-[#d97757] mb-5 block tracking-tight">
              AgentTasks
            </Link>
            <nav className="flex flex-col gap-0.5 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}
                  className="py-2 px-3 rounded-lg text-[#b0aea5] hover:text-[#faf9f5] hover:bg-[#1c1c1b] transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1 md:ml-56 pb-20 md:pb-8">
            <header className="md:hidden sticky top-0 z-50 bg-[#141413]/90 backdrop-blur-lg border-b border-[#2a2a28] px-4 py-3">
              <Link href="/" className="text-base font-bold text-[#d97757] tracking-tight">AgentTasks</Link>
            </header>
            <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl mx-auto md:mx-0">{children}</div>
          </main>

          {/* Mobile bottom tabs */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#141413]/95 backdrop-blur-lg border-t border-[#2a2a28]">
            <div className="flex justify-around py-2 pb-[env(safe-area-inset-bottom)]">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] text-[#b0aea5] active:text-[#d97757]">
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
