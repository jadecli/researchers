"use client";

import { useState } from "react";

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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [newTask, setNewTask] = useState("");

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, {
      id: tasks.length + 1,
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
      case "completed": return "text-green-400";
      case "in_progress": return "text-yellow-400";
      case "pending": return "text-zinc-500";
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Task Queue</h1>
        <p className="text-zinc-400 mt-2">
          Following Claude Code&apos;s canonical task schema (TodoWrite format).
          Click a task to cycle its status.
        </p>
      </div>

      {/* Add task */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a new task..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <button
          onClick={addTask}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white hover:bg-zinc-700 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Task list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800/50">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => toggleStatus(task.id)}
            className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/50 transition-colors text-left"
          >
            <span className={`text-lg ${statusColor(task.status)}`}>
              {statusIcon(task.status)}
            </span>
            <div className="flex-1">
              <div className={`${task.status === "completed" ? "text-zinc-500 line-through" : "text-white"}`}>
                {task.content}
              </div>
              {task.activeForm && task.status === "in_progress" && (
                <div className="text-xs text-yellow-500 mt-0.5">{task.activeForm}</div>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${
              task.status === "completed" ? "bg-green-900/50 text-green-400"
                : task.status === "in_progress" ? "bg-yellow-900/50 text-yellow-400"
                  : "bg-zinc-800 text-zinc-500"
            }`}>
              {task.status}
            </span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-zinc-500">
        <span>{tasks.filter(t => t.status === "completed").length} completed</span>
        <span>{tasks.filter(t => t.status === "in_progress").length} in progress</span>
        <span>{tasks.filter(t => t.status === "pending").length} pending</span>
      </div>
    </div>
  );
}
