"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

type Task = {
  id: number;
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
  description?: string;
};

const INITIAL_TASKS: Task[] = [
  { id: 1, content: "Git init all 8 repos with baseline commits", status: "completed" },
  { id: 2, content: "Install deps and verify imports (tsc clean)", status: "completed" },
  { id: 3, content: "Run vitest suites — 337/337 pass", status: "completed" },
  { id: 4, content: "Install Python deps and run pytest — 31/31 pass", status: "completed" },
  { id: 5, content: "Create Neon PG18 Kimball migrations (5 SQL files)", status: "completed" },
  { id: 6, content: "Build NeonDeltaFetchMiddleware + PostgresCacheStorage", status: "completed" },
  { id: 7, content: "Build Channel MCP server (22 tests pass)", status: "completed" },
  { id: 8, content: "Build dispatch routing engine (22 tests pass)", status: "completed" },
  { id: 9, content: "Execute Round 1 E2E crawl — 4 pages, 0.75 avg quality", status: "completed" },
  { id: 10, content: "Round 5 full crawl — 2,477 pages from 4 llms-full.txt", status: "completed" },
  { id: 11, content: "Build agenttasks.io Next.js webapp", status: "in_progress", activeForm: "Building webapp..." },
  { id: 12, content: "Deploy to Vercel with Neon PG18", status: "pending" },
];

const statusLabel = (status: Task["status"]) => {
  switch (status) {
    case "completed": return "Done";
    case "in_progress": return "Active";
    case "pending": return "Todo";
  }
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [newTask, setNewTask] = useState("");
  const nextId = useRef(INITIAL_TASKS.length + 1);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, {
      id: nextId.current++,
      content: newTask.trim(),
      status: "pending",
    }]);
    setNewTask("");
  };

  const toggleStatus = (id: number) => {
    setTasks(tasks.map(t => {
      if (t.id !== id) return t;
      const next = t.status === "pending" ? "in_progress"
        : t.status === "in_progress" ? "completed" : "pending";
      return { ...t, status: next as Task["status"] };
    }));
  };

  const statusIcon = (status: Task["status"]) => {
    switch (status) {
      case "completed": return "✓";
      case "in_progress": return "●";
      case "pending": return "○";
    }
  };

  const statusColor = (status: Task["status"]) => {
    switch (status) {
      case "completed": return "text-[#788c5d]";
      case "in_progress": return "text-[#d97757]";
      case "pending": return "text-[#6b6961]";
    }
  };

  const isAddDisabled = !newTask.trim();

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[#faf9f5]">Task Queue</h1>
        <p className="text-[#b0aea5] mt-2">
          Following Claude Code&apos;s canonical task schema (TodoWrite format).
          Click a task to cycle its status.
        </p>
      </motion.div>

      {/* Add task */}
      <motion.div
        className="flex gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a new task..."
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="done"
          className="flex-1 bg-[#1c1c1b] border border-[#2a2a28] rounded-lg px-4 py-2 text-[#faf9f5] placeholder:text-[#6b6961] focus:outline-none focus:border-[#d97757]"
        />
        <motion.button
          onClick={addTask}
          disabled={isAddDisabled}
          className="bg-[#252524] border border-[#2a2a28] rounded-lg px-4 py-2 text-[#faf9f5] hover:bg-[#2a2a28] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          whileHover={isAddDisabled ? undefined : { scale: 1.05 }}
          whileTap={isAddDisabled ? undefined : { scale: 0.95 }}
        >
          Add
        </motion.button>
      </motion.div>

      {/* Task list */}
      <motion.div
        className="bg-[#1c1c1b] border border-[#2a2a28] rounded-lg divide-y divide-[#2a2a28]/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <AnimatePresence initial={false}>
          {tasks.map((task, i) => (
            <motion.button
              key={task.id}
              layout
              onClick={() => toggleStatus(task.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-[#252524]/50 transition-colors text-left"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className={`text-lg ${statusColor(task.status)}`}>
                {statusIcon(task.status)}
              </span>
              <div className="flex-1">
                <div className={`${task.status === "completed" ? "text-[#6b6961] line-through" : "text-[#faf9f5]"}`}>
                  {task.content}
                </div>
                {task.activeForm && task.status === "in_progress" && (
                  <div className="text-xs text-[#d97757] mt-0.5">{task.activeForm}</div>
                )}
              </div>
              <span className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full ${
                task.status === "completed" ? "bg-[#788c5d]/20 text-[#788c5d]"
                  : task.status === "in_progress" ? "bg-[#d97757]/20 text-[#d97757]"
                    : "bg-[#252524] text-[#6b6961]"
              }`}>
                {statusLabel(task.status)}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="p-8 text-center text-[#6b6961] text-sm">
            No tasks yet. Add one above.
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div
        className="flex gap-4 text-sm text-[#6b6961]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <span>{tasks.filter(t => t.status === "completed").length} completed</span>
        <span>{tasks.filter(t => t.status === "in_progress").length} in progress</span>
        <span>{tasks.filter(t => t.status === "pending").length} pending</span>
      </motion.div>
    </div>
  );
}
