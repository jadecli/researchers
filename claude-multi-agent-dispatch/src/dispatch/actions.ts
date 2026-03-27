import { spawn } from 'node:child_process';
import { Ok, Err, type Result } from '../types/core.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RunStatus {
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  conclusion?: string;
}

// ─── ActionsDispatcher ──────────────────────────────────────────────────────
// Dispatches and monitors GitHub Actions workflows.

export class ActionsDispatcher {
  /**
   * Trigger a GitHub Actions workflow via gh CLI.
   */
  async triggerWorkflow(
    owner: string,
    repo: string,
    workflow: string,
    inputs: Record<string, string>,
  ): Promise<Result<{ runId: number }, Error>> {
    try {
      const inputArgs: string[] = [];
      for (const [key, value] of Object.entries(inputs)) {
        inputArgs.push('-f', `${key}=${value}`);
      }

      const result = await this.exec('gh', [
        'workflow',
        'run',
        workflow,
        '--repo',
        `${owner}/${repo}`,
        ...inputArgs,
      ]);

      if (result.exitCode !== 0) {
        return Err(new Error(`Failed to trigger workflow: ${result.stderr}`));
      }

      // Get the most recent run ID for this workflow
      const listResult = await this.exec('gh', [
        'run',
        'list',
        '--repo',
        `${owner}/${repo}`,
        '--workflow',
        workflow,
        '--limit',
        '1',
        '--json',
        'databaseId',
      ]);

      if (listResult.exitCode !== 0) {
        return Err(new Error(`Failed to get run ID: ${listResult.stderr}`));
      }

      const runs = JSON.parse(listResult.stdout) as { databaseId: number }[];
      const runId = runs[0]?.databaseId;

      if (!runId) {
        return Err(new Error('Could not determine run ID after triggering workflow'));
      }

      return Ok({ runId });
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Poll the status of a workflow run, yielding status updates.
   */
  async *monitorRun(
    owner: string,
    repo: string,
    runId: number,
  ): AsyncGenerator<RunStatus> {
    const maxPolls = 120; // 120 * 5s = 10 min max
    const pollIntervalMs = 5000;

    for (let i = 0; i < maxPolls; i++) {
      try {
        const result = await this.exec('gh', [
          'run',
          'view',
          String(runId),
          '--repo',
          `${owner}/${repo}`,
          '--json',
          'status,conclusion',
        ]);

        if (result.exitCode === 0) {
          const data = JSON.parse(result.stdout) as {
            status: string;
            conclusion: string | null;
          };

          const status = this.mapStatus(data.status);
          const runStatus: RunStatus = {
            status,
            conclusion: data.conclusion ?? undefined,
          };

          yield runStatus;

          if (status === 'completed' || status === 'failed') {
            return;
          }
        }
      } catch {
        // Ignore transient errors during polling
      }

      await this.sleep(pollIntervalMs);
    }

    yield { status: 'failed', conclusion: 'timeout' };
  }

  /**
   * Get artifact names/paths from a completed run.
   */
  async getArtifacts(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<string[]> {
    try {
      const result = await this.exec('gh', [
        'run',
        'view',
        String(runId),
        '--repo',
        `${owner}/${repo}`,
        '--json',
        'artifacts',
      ]);

      if (result.exitCode !== 0) return [];

      const data = JSON.parse(result.stdout) as {
        artifacts: { name: string }[];
      };

      return data.artifacts.map((a) => a.name);
    } catch {
      return [];
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private mapStatus(ghStatus: string): RunStatus['status'] {
    switch (ghStatus) {
      case 'queued':
      case 'waiting':
      case 'pending':
        return 'queued';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      default:
        return 'failed';
    }
  }

  private exec(
    command: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
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

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
