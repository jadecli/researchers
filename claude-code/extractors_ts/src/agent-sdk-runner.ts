/**
 * Agent SDK runner that wraps `claude -p` subprocess calls.
 */

import { spawn } from "node:child_process";
import type { AgentSDKOptions } from "./types.js";

interface RunResult {
  success: boolean;
  output: string;
  parsed: Record<string, unknown> | null;
  exitCode: number;
  duration: number;
}

/**
 * AgentSDKRunner wraps the `claude` CLI for programmatic use.
 */
export class AgentSDKRunner {
  private claudePath: string;
  private defaultOptions: AgentSDKOptions;

  constructor(
    claudePath: string = "claude",
    defaultOptions: AgentSDKOptions = {}
  ) {
    this.claudePath = claudePath;
    this.defaultOptions = defaultOptions;
  }

  /**
   * Run a prompt through the Claude CLI with JSON output.
   */
  async run(prompt: string, options?: AgentSDKOptions): Promise<RunResult> {
    const opts = { ...this.defaultOptions, ...options };
    const args = this.buildArgs(prompt, opts);
    const startTime = Date.now();

    return new Promise<RunResult>((resolve) => {
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      const proc = spawn(this.claudePath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        errChunks.push(chunk);
      });

      proc.on("close", (code) => {
        const exitCode = code ?? 1;
        const output = Buffer.concat(chunks).toString("utf-8");
        const duration = Date.now() - startTime;

        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(output);
        } catch {
          // Output is not JSON
        }

        resolve({
          success: exitCode === 0,
          output,
          parsed,
          exitCode,
          duration,
        });
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          output: err.message,
          parsed: null,
          exitCode: 1,
          duration: Date.now() - startTime,
        });
      });

      // Send prompt via stdin if using pipe mode
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  /**
   * Run a prompt and stream output line by line.
   */
  async *stream(
    prompt: string,
    options?: AgentSDKOptions
  ): AsyncGenerator<string, void, unknown> {
    const opts = {
      ...this.defaultOptions,
      ...options,
      outputFormat: "stream-json" as const,
    };
    const args = this.buildArgs(prompt, opts);

    const proc = spawn(this.claudePath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    proc.stdin.write(prompt);
    proc.stdin.end();

    let buffer = "";

    const reader = proc.stdout;

    for await (const chunk of reader) {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          yield line;
        }
      }
    }

    if (buffer.trim()) {
      yield buffer;
    }
  }

  private buildArgs(prompt: string, opts: AgentSDKOptions): string[] {
    const args: string[] = ["-p", "--output-format", opts.outputFormat || "json"];

    if (opts.maxTurns !== undefined) {
      args.push("--max-turns", String(opts.maxTurns));
    }

    if (opts.systemPrompt) {
      args.push("--system-prompt", opts.systemPrompt);
    }

    if (opts.allowedTools && opts.allowedTools.length > 0) {
      args.push("--allowedTools", opts.allowedTools.join(","));
    }

    if (opts.model) {
      args.push("--model", opts.model);
    }

    args.push(prompt);

    return args;
  }
}
