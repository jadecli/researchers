"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ── AgentTasks primary nav ─────────────────────────────── */
const NAV = [
  { label: "Overview", href: "/", icon: "⬡" },
  { label: "Docs", href: "/what-are-tasks", icon: "◈" },
  { label: "Create", href: "/task-creation", icon: "✦" },
  { label: "Spec", href: "/specification", icon: "❖" },
  { label: "Rounds", href: "/rounds", icon: "◎" },
  { label: "Tasks", href: "/tasks", icon: "▣" },
  { label: "Experiments", href: "/experiments", icon: "⚗" },
];

/* ── Scrapy docs sidebar nav ────────────────────────────── */
type NavSection = { heading: string; items: { label: string; href: string }[] };

const SCRAPY_NAV: NavSection[] = [
  {
    heading: "First Steps",
    items: [
      { label: "Scrapy at a Glance", href: "/scrapy/first-steps/at-a-glance" },
      { label: "Installation Guide", href: "/scrapy/first-steps/installation" },
      { label: "Scrapy Tutorial", href: "/scrapy/first-steps/tutorial" },
      { label: "Examples", href: "/scrapy/first-steps/examples" },
    ],
  },
  {
    heading: "Basic Concepts",
    items: [
      { label: "Command Line Tool", href: "/scrapy/basic-concepts/command-line" },
      { label: "Spiders", href: "/scrapy/basic-concepts/spiders" },
      { label: "Selectors", href: "/scrapy/basic-concepts/selectors" },
      { label: "Items", href: "/scrapy/basic-concepts/items" },
      { label: "Item Loaders", href: "/scrapy/basic-concepts/item-loaders" },
      { label: "Scrapy Shell", href: "/scrapy/basic-concepts/shell" },
      { label: "Item Pipeline", href: "/scrapy/basic-concepts/item-pipeline" },
      { label: "Feed Exports", href: "/scrapy/basic-concepts/feed-exports" },
      { label: "Requests & Responses", href: "/scrapy/basic-concepts/requests-responses" },
      { label: "Link Extractors", href: "/scrapy/basic-concepts/link-extractors" },
      { label: "Settings", href: "/scrapy/basic-concepts/settings" },
      { label: "Exceptions", href: "/scrapy/basic-concepts/exceptions" },
    ],
  },
  {
    heading: "Built-in Services",
    items: [
      { label: "Logging", href: "/scrapy/built-in/logging" },
      { label: "Stats Collection", href: "/scrapy/built-in/stats-collection" },
      { label: "Telnet Console", href: "/scrapy/built-in/telnet-console" },
    ],
  },
  {
    heading: "Solving Problems",
    items: [
      { label: "FAQ", href: "/scrapy/solving-problems/faq" },
      { label: "Debugging Spiders", href: "/scrapy/solving-problems/debugging-spiders" },
      { label: "Spiders Contracts", href: "/scrapy/solving-problems/contracts" },
      { label: "Common Practices", href: "/scrapy/solving-problems/common-practices" },
      { label: "Broad Crawls", href: "/scrapy/solving-problems/broad-crawls" },
      { label: "Developer Tools", href: "/scrapy/solving-problems/dev-tools" },
      { label: "Dynamic Content", href: "/scrapy/solving-problems/dynamic-content" },
      { label: "Memory Leaks", href: "/scrapy/solving-problems/memory-leaks" },
      { label: "Files & Images", href: "/scrapy/solving-problems/files-images" },
      { label: "Deploying Spiders", href: "/scrapy/solving-problems/deploying" },
      { label: "AutoThrottle", href: "/scrapy/solving-problems/autothrottle" },
      { label: "Benchmarking", href: "/scrapy/solving-problems/benchmarking" },
      { label: "Jobs", href: "/scrapy/solving-problems/jobs" },
      { label: "Coroutines", href: "/scrapy/solving-problems/coroutines" },
      { label: "asyncio", href: "/scrapy/solving-problems/asyncio" },
    ],
  },
  {
    heading: "Extending Scrapy",
    items: [
      { label: "Architecture Overview", href: "/scrapy/extending/architecture" },
      { label: "Add-ons", href: "/scrapy/extending/addons" },
      { label: "Downloader Middleware", href: "/scrapy/extending/downloader-middleware" },
      { label: "Spider Middleware", href: "/scrapy/extending/spider-middleware" },
      { label: "Extensions", href: "/scrapy/extending/extensions" },
      { label: "Signals", href: "/scrapy/extending/signals" },
      { label: "Scheduler", href: "/scrapy/extending/scheduler" },
      { label: "Item Exporters", href: "/scrapy/extending/item-exporters" },
      { label: "Download Handlers", href: "/scrapy/extending/download-handlers" },
      { label: "Components", href: "/scrapy/extending/components" },
      { label: "Core API", href: "/scrapy/extending/core-api" },
    ],
  },
  {
    heading: "Reference",
    items: [
      { label: "Release Notes", href: "/scrapy/reference/release-notes" },
      { label: "Contributing", href: "/scrapy/reference/contributing" },
      { label: "Versioning", href: "/scrapy/reference/versioning" },
    ],
  },
];

/* ── Top-level tabs ─────────────────────────────────────── */
const TABS = [
  { label: "AgentTasks", href: "/", prefix: "" },
  { label: "Scrapy", href: "/scrapy", prefix: "/scrapy" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isScrapy = pathname.startsWith("/scrapy");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const isExactActive = (href: string) => pathname === href;

  return (
    <div className="flex flex-col md:flex-row min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 border-r border-[#2a2a28] fixed h-full flex-col">
        {/* Top tabs */}
        <div className="flex border-b border-[#2a2a28]">
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex-1 py-3 text-center text-xs font-semibold tracking-wider transition-colors ${
                (tab.prefix === "/scrapy" ? isScrapy : !isScrapy)
                  ? "text-[#d97757] bg-[#1c1c1b] border-b-2 border-[#d97757]"
                  : "text-[#6b6961] hover:text-[#b0aea5]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Nav content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {isScrapy ? (
              <motion.nav
                key="scrapy"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <Link href="/scrapy" className={`text-xs font-bold block mb-2 ${isExactActive("/scrapy") ? "text-[#d97757]" : "text-[#b0aea5] hover:text-[#d97757]"}`}>
                  Scrapy Docs
                </Link>
                {SCRAPY_NAV.map((section) => (
                  <div key={section.heading}>
                    <div className="text-[10px] font-semibold text-[#6b6961] uppercase tracking-wider mb-1">
                      {section.heading}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`py-1 px-2 rounded text-xs transition-colors ${
                            isExactActive(item.href)
                              ? "bg-[#1c1c1b] text-[#faf9f5] font-medium"
                              : "text-[#b0aea5] hover:text-[#faf9f5] hover:bg-[#1c1c1b]"
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.nav>
            ) : (
              <motion.nav
                key="main"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex flex-col gap-0.5 text-sm"
              >
                <Link href="/" className="text-base font-bold text-[#d97757] mb-4 block tracking-tight">
                  AgentTasks
                </Link>
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href}
                    className={`py-2 px-3 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? "bg-[#1c1c1b] text-[#faf9f5] font-medium"
                        : "text-[#b0aea5] hover:text-[#faf9f5] hover:bg-[#1c1c1b]"
                    }`}>
                    {item.label}
                  </Link>
                ))}
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-60 pb-20 md:pb-8">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-50 bg-[#141413]/90 backdrop-blur-lg border-b border-[#2a2a28]">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="text-base font-bold text-[#d97757] tracking-tight">AgentTasks</Link>
            <div className="flex items-center gap-3">
              <Link
                href="/scrapy"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  isScrapy ? "bg-[#d97757]/20 text-[#d97757]" : "text-[#6b6961]"
                }`}
              >
                Scrapy
              </Link>
              {isScrapy && (
                <button
                  onClick={() => setMobileMenuOpen((o) => !o)}
                  className="text-[#b0aea5] min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? "✕" : "☰"}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Scrapy dropdown menu */}
          <AnimatePresence>
            {isScrapy && mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden border-t border-[#2a2a28]"
              >
                <nav className="px-4 py-3 max-h-[60vh] overflow-y-auto space-y-3">
                  {SCRAPY_NAV.map((section) => (
                    <div key={section.heading}>
                      <div className="text-[10px] font-semibold text-[#6b6961] uppercase tracking-wider mb-1">
                        {section.heading}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {section.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`py-1.5 px-2 rounded text-xs transition-colors ${
                              isExactActive(item.href)
                                ? "bg-[#1c1c1b] text-[#faf9f5] font-medium"
                                : "text-[#b0aea5] active:text-[#d97757]"
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto md:mx-0">{children}</div>
      </main>

      {/* Mobile bottom tabs — only show for main nav, not scrapy */}
      {!isScrapy && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#141413]/95 backdrop-blur-lg border-t border-[#2a2a28]">
          <div className="flex justify-around py-2 pb-[env(safe-area-inset-bottom)]">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 text-[10px] ${
                  isActive(item.href)
                    ? "text-[#d97757]"
                    : "text-[#b0aea5] active:text-[#d97757]"
                }`}>
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
