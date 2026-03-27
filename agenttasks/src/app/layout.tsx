import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentTasks — Open format for AI agent task orchestration",
  description:
    "A data-driven task orchestration platform for AI agents. Built on crawled documentation from Claude, Neon, and Vercel. Powered by Next.js + Neon Postgres 18.",
};

const NAV_ITEMS = [
  { label: "Overview", href: "/" },
  { label: "What are tasks?", href: "/what-are-tasks" },
  { label: "Specification", href: "/specification" },
  {
    label: "Task Creation",
    children: [
      { label: "Quickstart", href: "/task-creation/quickstart" },
      { label: "Best Practices", href: "/task-creation/best-practices" },
      { label: "Evaluating Tasks", href: "/task-creation/evaluating-tasks" },
      { label: "Optimizing Targets", href: "/task-creation/optimizing-targets" },
      { label: "Using Spiders", href: "/task-creation/using-spiders" },
    ],
  },
  {
    label: "Integration",
    children: [
      { label: "Adding Task Support", href: "/integration/adding-task-support" },
    ],
  },
  { label: "Pages", href: "/pages" },
  { label: "Rounds", href: "/rounds" },
  { label: "Tasks", href: "/tasks" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex bg-zinc-950 text-zinc-100">
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-800 p-6 flex flex-col gap-1 fixed h-full overflow-y-auto">
          <Link href="/" className="text-lg font-bold text-white mb-6 block">
            AgentTasks
          </Link>
          <nav className="flex flex-col gap-0.5 text-sm">
            {NAV_ITEMS.map((item) =>
              "children" in item && item.children ? (
                <div key={item.label} className="mt-4">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    {item.label}
                  </div>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block py-1.5 px-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block py-1.5 px-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="ml-64 flex-1 p-8 max-w-4xl">{children}</main>
      </body>
    </html>
  );
}
