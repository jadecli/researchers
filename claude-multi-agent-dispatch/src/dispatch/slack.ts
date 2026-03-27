import { Ok, Err, type Result } from '../types/core.js';

// ─── SlackDispatcher ────────────────────────────────────────────────────────
// Posts dispatch-related messages to Slack via incoming webhooks.

export class SlackDispatcher {
  private readonly webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * Post a dispatch request notification with cost estimate.
   */
  async postDispatchRequest(
    task: string,
    estimatedCost: number,
  ): Promise<Result<void, Error>> {
    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'New Dispatch Request',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Task:*\n${truncate(task, 200)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Estimated Cost:*\n$${estimatedCost.toFixed(4)}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Submitted at ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    return this.sendWebhook(payload);
  }

  /**
   * Post dispatch result with quality score.
   */
  async postResult(
    dispatchId: string,
    summary: string,
    score: number,
  ): Promise<Result<void, Error>> {
    const color = score >= 0.7 ? '#36a64f' : score >= 0.5 ? '#daa520' : '#ff0000';

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `Dispatch Complete: ${dispatchId}`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Summary:*\n${truncate(summary, 300)}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Quality Score:*\n${score.toFixed(2)}`,
                },
              ],
            },
          ],
        },
      ],
    };

    return this.sendWebhook(payload);
  }

  /**
   * Post a quality alert (red/green based on pass/fail).
   */
  async postQualityAlert(
    roundId: string,
    score: number,
    threshold: number,
  ): Promise<Result<void, Error>> {
    const passed = score >= threshold;
    const color = passed ? '#36a64f' : '#ff0000';
    const emoji = passed ? ':white_check_mark:' : ':x:';
    const status = passed ? 'PASSED' : 'FAILED';

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${emoji} *Quality Gate ${status}*\n*Round:* ${roundId}\n*Score:* ${score.toFixed(2)} (threshold: ${threshold.toFixed(2)})`,
              },
            },
          ],
        },
      ],
    };

    return this.sendWebhook(payload);
  }

  /**
   * Post a round summary with per-dimension scores.
   */
  async postRoundSummary(
    roundId: string,
    summary: string,
    scores: Record<string, number>,
  ): Promise<Result<void, Error>> {
    const scoreLines = Object.entries(scores)
      .map(([dim, val]) => `  ${dim}: ${val.toFixed(2)}`)
      .join('\n');

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `Round Summary: ${roundId}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: truncate(summary, 500),
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Scores:*\n\`\`\`\n${scoreLines}\n\`\`\``,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Completed at ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    return this.sendWebhook(payload);
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async sendWebhook(
    payload: Record<string, unknown>,
  ): Promise<Result<void, Error>> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        return Err(
          new Error(`Slack webhook failed (${response.status}): ${body}`),
        );
      }

      return Ok(undefined);
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
