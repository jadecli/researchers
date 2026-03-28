// src/orchestrator/headless-runner.ts — HeadlessRunner wrapping claude -p subprocess
import { execSync, spawn } from 'node:child_process';
import type { Result } from '../types.js';
import { Err, Ok } from '../types.js';

// ── Runner Errors ───────────────────────────────────────────────
export class RunnerError extends Error {
  constructor(
    message: string,
    readonly exitCode?: number,
  ) {
    super(message);
    this.name = 'RunnerError';
  }
}

export class RunnerTimeoutError extends RunnerError {
  constructor(timeoutMs: number) {
    super(`HeadlessRunner timed out after ${timeoutMs}ms`);
    this.name = 'RunnerTimeoutError';
  }
}

export class RunnerNotFoundError extends RunnerError {
  constructor(binary: string) {
    super(
      `Claude binary not found: ${binary}. Ensure Claude CLI is installed and in PATH.`,
    );
    this.name = 'RunnerNotFoundError';
  }
}

// ── Configuration ───────────────────────────────────────────────
export interface HeadlessRunnerConfig {
  readonly claudeBinary: string;
  readonly timeoutMs: number;
  readonly model: string | undefined;
  readonly allowedTools: readonly string[] | undefined;
  readonly maxTurns: number;
}

const DEFAULT_CONFIG: HeadlessRunnerConfig = {
  claudeBinary: 'claude',
  timeoutMs: 300_000,
  model: undefined,
  allowedTools: undefined,
  maxTurns: 10,
};

// ── Stream Event ────────────────────────────────────────────────
export interface StreamEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

// ── HeadlessRunner ──────────────────────────────────────────────
export class HeadlessRunner {
  private readonly config: HeadlessRunnerConfig;

  constructor(config?: Partial<HeadlessRunnerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private buildCommand(prompt: string, streaming: boolean): readonly string[] {
    const cmd: string[] = [this.config.claudeBinary, '-p', prompt];
    if (streaming) {
      cmd.push('--output-format', 'stream-json');
    } else {
      cmd.push('--output-format', 'json');
    }
    if (this.config.model) {
      cmd.push('--model', this.config.model);
    }
    if (this.config.allowedTools) {
      for (const tool of this.config.allowedTools) {
        cmd.push('--allowedTools', tool);
      }
    }
    cmd.push('--max-turns', String(this.config.maxTurns));
    return cmd;
  }

  run(prompt: string): Result<string, RunnerError> {
    const cmd = this.buildCommand(prompt, false);
    const execResult = this.execSafe(cmd);
    if (!execResult.ok) return execResult;
    return Ok(this.parseJsonOutput(execResult.value));
  }

  private execSafe(cmd: readonly string[]): Result<string, RunnerError> {
    try {
      const result = execSync(cmd.join(' '), {
        timeout: this.config.timeoutMs,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return Ok(result);
    } catch (e: unknown) {
      if (e instanceof Error && 'killed' in e) {
        return Err(new RunnerTimeoutError(this.config.timeoutMs));
      }
      if (
        e instanceof Error &&
        'code' in e &&
        (e as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return Err(new RunnerNotFoundError(this.config.claudeBinary));
      }
      const msg = e instanceof Error ? e.message : String(e);
      return Err(new RunnerError(`HeadlessRunner failed: ${msg}`));
    }
  }

  private parseJsonOutput(raw: string): string {
    const parsed = this.tryParseJson(raw);
    if (parsed !== undefined && typeof parsed['result'] === 'string') {
      return parsed['result'];
    }
    return raw.trim();
  }

  private tryParseJson(raw: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  async runStreaming(
    prompt: string,
  ): Promise<Result<readonly StreamEvent[], RunnerError>> {
    const cmd = this.buildCommand(prompt, true);
    return new Promise((resolve) => {
      try {
        const proc = spawn(cmd[0]!, cmd.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const events: StreamEvent[] = [];
        let stderr = '';

        proc.stdout.on('data', (chunk: Buffer) => {
          const lines = chunk.toString('utf-8').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parsed = this.tryParseJson(trimmed);
            if (parsed !== undefined) {
              events.push(parsed as StreamEvent);
            }
          }
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf-8');
        });

        proc.on('close', (code) => {
          if (code !== 0) {
            resolve(
              Err(
                new RunnerError(
                  `HeadlessRunner (streaming) exited with code ${code}: ${stderr.slice(0, 500)}`,
                  code ?? undefined,
                ),
              ),
            );
          } else {
            resolve(Ok(events));
          }
        });

        proc.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            resolve(Err(new RunnerNotFoundError(this.config.claudeBinary)));
          } else {
            resolve(Err(new RunnerError(err.message)));
          }
        });

        setTimeout(() => {
          proc.kill();
          resolve(Err(new RunnerTimeoutError(this.config.timeoutMs)));
        }, this.config.timeoutMs);
      } catch (e) {
        resolve(
          Err(
            new RunnerError(e instanceof Error ? e.message : String(e)),
          ),
        );
      }
    });
  }

  checkAvailable(): Result<boolean, RunnerError> {
    const result = this.execSafe([this.config.claudeBinary, '--version']);
    return result.ok ? Ok(true) : Err(new RunnerNotFoundError(this.config.claudeBinary));
  }
}
