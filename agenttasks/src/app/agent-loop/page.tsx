"use client";

import { useState, useEffect, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
} from "motion/react";

/* ─────────────────────────── DSPy-style typed signatures ─────────────────────────── */
/*
 * Mirrors the pattern from claude-code-agents-python/src/dspy_pipeline/signatures.py
 * Each data structure is a typed "signature" with InputFields and OutputFields.
 * This makes the page data machine-readable for agent evaluation (agentevals).
 *
 * DSPy Signature: AgentLoopVisualizer
 *   InputField: user_prompt (string) — the natural language task
 *   OutputField: phases (Phase[]) — ordered execution phases
 *   OutputField: tool_calls (ToolCall[]) — tool invocations with results
 *   OutputField: loop_complete (boolean) — whether task is finished
 */

type Phase = {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly icon: string;
  readonly description: string;
  readonly tools: readonly string[];
};

type ToolCategory = {
  readonly category: string;
  readonly icon: string;
  readonly tools: readonly string[];
  readonly color: string;
  /** bloom-compatible: true if tool is read-only and fingerprintable for bloom filter pre-check */
  readonly bloomCompatible: boolean;
};

type LoopStep = {
  readonly step: number;
  readonly action: string;
  readonly phase: string;
  readonly result: string;
  /** DSPy confidence score (0.0–1.0) from QualityScorer signature */
  readonly confidence: number;
};

/* ─────────────────────────── data (deterministic, no randomness) ─────────────────────────── */

const PHASES: readonly Phase[] = [
  {
    id: "gather",
    label: "Gather Context",
    color: "#3b82f6",
    icon: "🔍",
    description:
      "Claude searches files, reads code, and explores your codebase to understand the problem. Bloom-compatible tools (Read, Glob, Grep) can be pre-checked via bloom filter before dispatch.",
    tools: ["Read files", "Grep content", "Glob patterns", "Git history"],
  },
  {
    id: "action",
    label: "Take Action",
    color: "#10b981",
    icon: "⚡",
    description:
      "Claude edits code, runs commands, creates files, and makes coordinated changes across your project. Write ops bypass bloom filters (never-dedup).",
    tools: ["Edit files", "Run commands", "Write files", "Install packages"],
  },
  {
    id: "verify",
    label: "Verify Results",
    color: "#f59e0b",
    icon: "✓",
    description:
      "Claude runs tests, checks for errors, and validates changes. Quality scored via DSPy QualityScorer signature across 5 dimensions: completeness, structure, accuracy, coherence, safety.",
    tools: ["Run tests", "Check types", "Lint code", "Review output"],
  },
] as const;

/**
 * Tool categories with bloom filter compatibility flags.
 * Mirrors the bloom filter routing design from bootstrap.xml:
 *   bloom-compatible = read-only, fingerprintable → Haiku pre-check
 *   never-dedup = write ops, state changes → skip bloom, dispatch directly
 */
const TOOL_CATEGORIES: readonly ToolCategory[] = [
  {
    category: "File Operations",
    icon: "📁",
    tools: ["Read", "Edit", "Write", "Rename"],
    color: "#6366f1",
    bloomCompatible: false, // mixed: Read=yes, Edit/Write=no
  },
  {
    category: "Search",
    icon: "🔎",
    tools: ["Glob", "Grep", "Find refs", "Jump to def"],
    color: "#8b5cf6",
    bloomCompatible: true, // all read-only, fingerprintable
  },
  {
    category: "Execution",
    icon: "▶",
    tools: ["Shell", "Tests", "Build", "Git"],
    color: "#ec4899",
    bloomCompatible: false, // state-changing
  },
  {
    category: "Web",
    icon: "🌐",
    tools: ["Fetch docs", "Search web", "API calls"],
    color: "#14b8a6",
    bloomCompatible: true, // read-only
  },
  {
    category: "Intelligence",
    icon: "🧠",
    tools: ["Type errors", "Diagnostics", "Subagents"],
    color: "#f97316",
    bloomCompatible: false, // subagents = state-changing
  },
] as const;

/**
 * Deterministic walkthrough steps with DSPy-style confidence scores.
 * Each step maps to a phase from the agentic loop.
 * Confidence mirrors QualityScorer.completeness from signatures.py.
 */
const LOOP_STEPS: readonly LoopStep[] = [
  { step: 1, action: "Run test suite", phase: "verify", result: "3 tests fail", confidence: 0.2 },
  { step: 2, action: "Read error output", phase: "gather", result: "TypeError in auth.ts:42", confidence: 0.4 },
  { step: 3, action: "Search for auth.ts", phase: "gather", result: "Found src/auth/auth.ts", confidence: 0.5 },
  { step: 4, action: "Read source file", phase: "gather", result: "Missing null check on line 42", confidence: 0.7 },
  { step: 5, action: "Edit auth.ts", phase: "action", result: "Added guard clause at line 42", confidence: 0.85 },
  { step: 6, action: "Run tests again", phase: "verify", result: "All 386 tests pass ✓", confidence: 1.0 },
] as const;

/**
 * Shannon 5-step thinking phases from claude-dspy-crawl-planning.
 * Used for the "How Your Prompt Flows" visualization.
 * Mirrors: problem_definition → constraints → model → proof → implementation
 */
const PROMPT_FLOW_STEPS = [
  {
    label: "Your Prompt",
    desc: "Natural language instruction → problem_definition",
    color: "#a78bfa",
    icon: "💬",
    shannon: "problem_definition",
  },
  {
    label: "Claude Reasons",
    desc: "Analyzes constraints and plans approach",
    color: "#3b82f6",
    icon: "🧠",
    shannon: "constraints",
  },
  {
    label: "Tool Selection",
    desc: "Models the solution → picks the right tool",
    color: "#10b981",
    icon: "🔧",
    shannon: "model",
  },
  {
    label: "Execute & Observe",
    desc: "Runs tool, validates result (proof step)",
    color: "#f59e0b",
    icon: "▶",
    shannon: "proof",
  },
  {
    label: "Loop or Complete",
    desc: "Implementation: loop back or deliver result",
    color: "#ef4444",
    icon: "🔄",
    shannon: "implementation",
  },
] as const;

/* ─────────────────────────── components ─────────────────────────── */

/**
 * Animated ring diagram showing the 3-phase agentic loop.
 * Phase nodes are positioned at 120° intervals around the ring.
 * Orbital animation uses CSS transform-origin for smooth rotation.
 */
function LoopRing({ active }: { active: number }) {
  return (
    <div className="relative w-72 h-72 mx-auto my-8">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="50%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="2"
          strokeDasharray="8 4"
        />
        <motion.circle
          cx="100"
          cy="15"
          r="5"
          fill={PHASES[active].color}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          style={{ originX: "100px", originY: "100px", transformOrigin: "100px 100px" }}
        />
      </svg>

      {PHASES.map((phase, i) => {
        const angle = (i * 120 - 90) * (Math.PI / 180);
        const x = 50 + 42 * Math.cos(angle);
        const y = 50 + 42 * Math.sin(angle);
        const isActive = i === active;

        return (
          <motion.div
            key={phase.id}
            className="absolute flex flex-col items-center gap-1"
            style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
            animate={{ scale: isActive ? 1.15 : 0.9, opacity: isActive ? 1 : 0.5 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <motion.div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg"
              style={{ backgroundColor: phase.color + "22", borderColor: phase.color }}
              animate={{
                borderWidth: isActive ? 2 : 1,
                boxShadow: isActive ? `0 0 20px ${phase.color}44` : `0 0 0px ${phase.color}00`,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <span className="text-2xl">{phase.icon}</span>
            </motion.div>
            <span
              className="text-xs font-medium whitespace-nowrap"
              style={{ color: isActive ? phase.color : "#71717a" }}
            >
              {phase.label}
            </span>
          </motion.div>
        );
      })}

      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="text-center px-4"
          >
            <div className="text-sm font-semibold text-white">{PHASES[active].label}</div>
            <div className="text-xs text-zinc-500 mt-0.5 max-w-[140px]">
              {PHASES[active].description.split(".")[0]}.
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Expandable phase card with spring animations.
 * Pattern: identical to experiments/[id]/page.tsx card structure.
 * Uses whileTap for iOS-forward touch feedback.
 */
function PhaseCard({
  phase,
  index,
  isActive,
  onTap,
}: {
  phase: Phase;
  index: number;
  isActive: boolean;
  onTap: () => void;
}) {
  const y = useMotionValue(0);
  const shadow = useTransform(
    y,
    [-20, 0],
    [`0 20px 40px ${phase.color}22`, `0 4px 12px ${phase.color}11`]
  );

  return (
    <motion.div
      layout
      onTap={onTap}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: index * 0.12 }}
      whileTap={{ scale: 0.97 }}
      style={{ y, boxShadow: shadow }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-5 cursor-pointer select-none"
    >
      <div className="flex items-center gap-3 mb-3">
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ backgroundColor: phase.color + "20" }}
          animate={{ rotate: isActive ? [0, -5, 5, 0] : 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {phase.icon}
        </motion.div>
        <div>
          <div className="font-semibold text-white text-sm">{phase.label}</div>
          <div className="text-xs text-zinc-500">Phase {index + 1}</div>
        </div>
        <motion.div
          className="ml-auto w-2 h-2 rounded-full"
          style={{ backgroundColor: phase.color }}
          animate={{ scale: isActive ? [1, 1.5, 1] : 1, opacity: isActive ? 1 : 0.3 }}
          transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
        />
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <p className="text-zinc-400 text-sm mb-3">{phase.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {phase.tools.map((tool, ti) => (
                <motion.span
                  key={tool}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: ti * 0.06 }}
                  className="text-xs px-2.5 py-1 rounded-full border"
                  style={{
                    borderColor: phase.color + "40",
                    color: phase.color,
                    backgroundColor: phase.color + "10",
                  }}
                >
                  {tool}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Tool category grid with bloom filter compatibility indicator.
 * Bloom-compatible tools (read-only, fingerprintable) show a green dot.
 * This mirrors the bloom filter routing from bootstrap.xml:
 *   Haiku pre-checks bloom → Sonnet dispatches if likely to succeed.
 */
function ToolGrid() {
  const [hoveredCat, setHoveredCat] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {TOOL_CATEGORIES.map((cat, i) => (
        <motion.div
          key={cat.category}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ type: "spring", stiffness: 260, damping: 24, delay: i * 0.08 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
          onHoverStart={() => setHoveredCat(i)}
          onHoverEnd={() => setHoveredCat(null)}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 cursor-default"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{cat.icon}</span>
            <span className="text-sm font-semibold text-white">{cat.category}</span>
            {cat.bloomCompatible && (
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                title="Bloom-compatible: can be pre-checked via bloom filter"
              >
                bloom
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cat.tools.map((tool, ti) => (
              <motion.span
                key={tool}
                className="text-xs px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: hoveredCat === i ? cat.color + "18" : "transparent",
                  color: hoveredCat === i ? cat.color : "#a1a1aa",
                  border: `1px solid ${hoveredCat === i ? cat.color + "30" : "#27272a"}`,
                }}
                animate={{ scale: hoveredCat === i ? 1.05 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: ti * 0.03 }}
              >
                {tool}
              </motion.span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Interactive step-by-step timeline with play/pause.
 * Shows confidence scores rising as the loop progresses.
 * Pattern: mirrors MiniBarChart from experiments/[id]/page.tsx.
 */
function StepTimeline() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const progress = useSpring(0, { stiffness: 100, damping: 20 });

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= LOOP_STEPS.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1600);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    progress.set((activeStep / (LOOP_STEPS.length - 1)) * 100);
  }, [activeStep, progress]);

  const progressWidth = useTransform(progress, (v) => `${v}%`);

  const phaseColor = useCallback(
    (pid: string) => PHASES.find((p) => p.id === pid)?.color ?? "#71717a",
    []
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm font-semibold text-white">
          Live: &quot;Fix the failing tests&quot;
        </div>
        <div className="flex items-center gap-3">
          {/* Confidence meter — mirrors QualityScorer completeness */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500">confidence</span>
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  backgroundColor:
                    LOOP_STEPS[activeStep].confidence >= 0.8
                      ? "#10b981"
                      : LOOP_STEPS[activeStep].confidence >= 0.5
                        ? "#f59e0b"
                        : "#ef4444",
                }}
                animate={{ width: `${LOOP_STEPS[activeStep].confidence * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              />
            </div>
            <span className="text-[10px] text-zinc-400 font-mono w-7">
              {LOOP_STEPS[activeStep].confidence.toFixed(1)}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              if (activeStep >= LOOP_STEPS.length - 1) setActiveStep(0);
              setIsPlaying(!isPlaying);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
          >
            {isPlaying ? "Pause" : activeStep >= LOOP_STEPS.length - 1 ? "Replay" : "Play"}
          </motion.button>
        </div>
      </div>

      <div className="h-1 bg-zinc-800 rounded-full mb-5 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 rounded-full"
          style={{ width: progressWidth }}
        />
      </div>

      <div className="space-y-2">
        {LOOP_STEPS.map((step, i) => {
          const isActive = i === activeStep;
          const isPast = i < activeStep;
          const color = phaseColor(step.phase);

          return (
            <motion.div
              key={step.step}
              onTap={() => {
                setActiveStep(i);
                setIsPlaying(false);
              }}
              animate={{ opacity: isPast || isActive ? 1 : 0.35, x: isActive ? 4 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: isActive ? color + "10" : "transparent" }}
            >
              <motion.div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: isPast || isActive ? color + "20" : "#27272a",
                  color: isPast || isActive ? color : "#52525b",
                  border: `1.5px solid ${isPast || isActive ? color + "40" : "#3f3f46"}`,
                }}
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                {isPast ? "✓" : step.step}
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{step.action}</div>
                <AnimatePresence>
                  {(isActive || isPast) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="overflow-hidden"
                    >
                      <span className="text-xs text-zinc-500">{step.result}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{ color, backgroundColor: color + "15", border: `1px solid ${color}30` }}
              >
                {step.phase}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── main page ─────────────────────────── */

export default function AgentLoopPage() {
  const [activePhase, setActivePhase] = useState(0);

  // Auto-cycle phases every 3s (deterministic interval)
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePhase((p) => (p + 1) % PHASES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="mb-12"
      >
        <div className="flex items-center gap-2 mb-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Interactive Guide
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">The Agent Crawl Loop</h1>
        <p className="text-zinc-400 text-base max-w-xl">
          When you give Claude a task, it works through an agentic loop — gathering context,
          taking action, and verifying results. Each tool use feeds back into the loop,
          informing the next decision. Quality scored via{" "}
          <span className="text-zinc-300 font-mono text-sm">DSPy QualityScorer</span>{" "}
          signature.
        </p>
      </motion.div>

      {/* Section 1: The Loop */}
      <section className="mb-16">
        <motion.h2
          className="text-lg font-semibold text-white mb-1"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          The Agentic Loop
        </motion.h2>
        <p className="text-sm text-zinc-500 mb-6">
          Three phases that blend together. Tap a card to explore.
        </p>

        <LoopRing active={activePhase} />

        <div className="grid grid-cols-1 gap-3 mt-6">
          {PHASES.map((phase, i) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              index={i}
              isActive={i === activePhase}
              onTap={() => setActivePhase(i)}
            />
          ))}
        </div>
      </section>

      {/* Section 2: Tools with bloom filter indicators */}
      <section className="mb-16">
        <motion.h2
          className="text-lg font-semibold text-white mb-1"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Built-in Tools
        </motion.h2>
        <p className="text-sm text-zinc-500 mb-6">
          Tools are what make Claude agentic. Categories marked{" "}
          <span className="text-emerald-400 font-mono text-xs">bloom</span> are read-only and
          can be pre-checked via bloom filter before dispatch (Haiku → Sonnet routing).
        </p>
        <ToolGrid />
      </section>

      {/* Section 3: Live walkthrough with confidence */}
      <section className="mb-16">
        <motion.h2
          className="text-lg font-semibold text-white mb-1"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          The Loop in Action
        </motion.h2>
        <p className="text-sm text-zinc-500 mb-6">
          Watch how Claude chains tool calls to fix a bug. Confidence rises as context
          accumulates — matching the{" "}
          <span className="text-zinc-300 font-mono text-sm">QualityScorer</span> completeness
          dimension.
        </p>
        <StepTimeline />
      </section>

      {/* Section 4: Shannon thinking flow */}
      <section className="mb-16">
        <motion.h2
          className="text-lg font-semibold text-white mb-1"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          How Your Prompt Flows
        </motion.h2>
        <p className="text-sm text-zinc-500 mb-6">
          Maps to Shannon 5-step thinking from{" "}
          <span className="text-zinc-300 font-mono text-sm">claude-dspy-crawl-planning</span>:
          problem → constraints → model → proof → implementation.
        </p>

        <div className="space-y-3">
          {PROMPT_FLOW_STEPS.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ type: "spring", stiffness: 260, damping: 24, delay: i * 0.1 }}
              className="flex items-center gap-4"
            >
              <div className="flex flex-col items-center">
                <motion.div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-base"
                  style={{
                    backgroundColor: item.color + "15",
                    border: `1.5px solid ${item.color}30`,
                  }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  {item.icon}
                </motion.div>
                {i < PROMPT_FLOW_STEPS.length - 1 && (
                  <motion.div
                    className="w-px h-3 mt-1"
                    style={{ backgroundColor: item.color + "30" }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                  />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{item.label}</div>
                <div className="text-xs text-zinc-500">{item.desc}</div>
                <div className="text-[10px] text-zinc-600 font-mono mt-0.5">
                  shannon: {item.shannon}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section 5: Key Insight */}
      <motion.section
        className="mb-12 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
      >
        <div className="text-sm font-semibold text-white mb-2">
          You&apos;re Part of the Loop
        </div>
        <p className="text-sm text-zinc-400 mb-3">
          You can interrupt at any point to steer Claude in a different direction, provide
          additional context, or ask it to try a different approach. Claude works autonomously
          but stays responsive to your input.
        </p>
        <div className="text-xs text-zinc-600 font-mono border-t border-zinc-800 pt-3 mt-3">
          Source: code.claude.com/docs/en/how-claude-code-works.md
          <br />
          Architecture: ARCHITECTURE.md § Orchestration Layer
          <br />
          DSPy signatures: claude-code-agents-python/src/dspy_pipeline/signatures.py
          <br />
          Bloom filter design: .claude/bootstrap.xml § bloom-filter-routing
        </div>
      </motion.section>
    </div>
  );
}
