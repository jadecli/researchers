import { NextResponse } from "next/server";

// In-memory task store (would be Neon PG18 in production)
const tasks = [
  { id: 1, content: "Git init all repos", status: "completed", createdAt: "2026-03-26" },
  { id: 2, content: "Run vitest suites", status: "completed", createdAt: "2026-03-26" },
  { id: 3, content: "Execute Round 5 crawl", status: "completed", createdAt: "2026-03-26" },
  { id: 4, content: "Build agenttasks webapp", status: "in_progress", createdAt: "2026-03-26" },
  { id: 5, content: "Deploy to Vercel", status: "pending", createdAt: "2026-03-26" },
];

export async function GET() {
  return NextResponse.json({ todos: tasks });
}

export async function POST(request: Request) {
  const body = await request.json() as { content: string; status?: string };
  const newTask = {
    id: tasks.length + 1,
    content: body.content,
    status: body.status ?? "pending",
    createdAt: new Date().toISOString().split("T")[0],
  };
  tasks.push(newTask);
  return NextResponse.json(newTask, { status: 201 });
}
