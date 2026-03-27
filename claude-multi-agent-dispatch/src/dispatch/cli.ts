import { spawn } from 'node:child_process';
import { Ok, Err, type Result } from '../types/core.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content: string;
  timestamp: Date;
}

// ─── HeadlessRunner ─────────────────────────────────────────────────────────
// Runs Claude CLI as a subprocess for headless dispatch.

export class HeadlessRunner {
  private readonly timeout: number;
  private readonly cwd: string;

  constructor(options?: { timeout?: number; cwd?: string }) {
    this.timeout = options?.timeout ?? 300_000; // 5 min default
    this.cwd = options?.cwd ?? process.cwd();
  }

  /**
   * Run a prompt through claude -p and capture the result.
   */
  async run(
    prompt: string,
    config: {
      model?: string;
      allowedTools?: string[];
      outputFormat?: 'text' | 'json';
    },
  ): Promise<Result<{ text: string; sessionId: string }, Error>> {
    const args = this.buildCommand(prompt, config);

    try {
      const result = await this.execProcess('claude', args);

      if (config.outputFormat === 'json') {
        try {
          const parsed = JSON.parse(result.stdout);
          return Ok({
            text: JSON.stringify(parsed),
            sessionId: parsed.session_id ?? `cli-${Date.now()}`,
          });
        } catch {
          return Err(new Error(`Failed to parse JSON output: ${result.stdout.slice(0, 200)}`));
        }
      }

      return Ok({
        text: result.stdout,
        sessionId: `cli-${Date.now()}`,
      });
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Run in streaming mode, yielding events as they arrive.
   */
  async *runStreaming(
    prompt: string,
    config: {
      model?: string;
      allowedTools?: string[];
      outputFormat?: 'text' | 'json';
    },
  ): AsyncGenerator<StreamEvent> {
    const args = this.buildCommand(prompt, {
      ...config,
      outputFormat: 'json',
    });

    const child = spawn('claude', args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';

    const stdoutIterator = this.streamLines(child.stdout as NodeJS.ReadableStream);

    for await (const line of stdoutIterator) {
      buffer += line;
      try {
        const parsed = JSON.parse(buffer) as Record<string, unknown>;
        buffer = '';

        yield {
          type: (parsed['type'] as StreamEvent['type']) ?? 'text',
          content:
            typeof parsed['content'] === 'string'
              ? parsed['content']
              : JSON.stringify(parsed),
          timestamp: new Date(),
        };
      } catch {
        // Incomplete JSON, continue buffering
      }
    }

    // Collect stderr
    let stderr = '';
    if (child.stderr) {
      for await (const chunk of child.stderr) {
        stderr += String(chunk);
      }
    }

    if (stderr.trim().length > 0) {
      yield {
        type: 'error',
        content: stderr,
        timestamp: new Date(),
      };
    }

    yield {
      type: 'done',
      content: '',
      timestamp: new Date(),
    };
  }

  /**
   * Build the CLI arguments array from prompt and config.
   */
  buildCommand(
    prompt: string,
    config: {
      model?: string;
      allowedTools?: string[];
      outputFormat?: 'text' | 'json';
    },
  ): string[] {
    const args: string[] = ['-p', prompt];

    if (config.model) {
      args.push('--model', config.model);
    }

    if (config.allowedTools && config.allowedTools.length > 0) {
      for (const tool of config.allowedTools) {
        args.push('--allowedTools', tool);
      }
    }

    if (config.outputFormat === 'json') {
      args.push('--output-format', 'stream-json');
    }

    return args;
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private execProcess(
    command: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Process timed out after ${this.timeout}ms`));
      }, this.timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `Process exited with code ${code}: ${stderr.slice(0, 500)}`,
            ),
          );
        } else {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private async *streamLines(
    stream: NodeJS.ReadableStream,
  ): AsyncGenerator<string> {
    let buffer = '';
    for await (const chunk of stream) {
      buffer += String(chunk);
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim().length > 0) {
          yield line;
        }
      }
    }
    if (buffer.trim().length > 0) {
      yield buffer;
    }
  }
}
