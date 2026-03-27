import { Ok, Err, type Result } from '../types/core.js';

// ─── ChromeDispatcher ───────────────────────────────────────────────────────
// Wraps MCP chrome tools for browser-based dispatch operations.
// In production these call through the MCP client; here we define the
// interface and provide a pluggable executor.

export type McpToolExecutor = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<Result<unknown, Error>>;

export class ChromeDispatcher {
  private readonly executor: McpToolExecutor;

  constructor(executor: McpToolExecutor) {
    this.executor = executor;
  }

  /**
   * Navigate to a URL using mcp__claude-in-chrome__navigate.
   */
  async navigate(url: string): Promise<Result<void, Error>> {
    const result = await this.executor('mcp__claude-in-chrome__navigate', {
      url,
    });

    if (!result.ok) {
      return Err(result.error);
    }

    return Ok(undefined);
  }

  /**
   * Navigate to a URL and extract page content.
   * Uses navigate + read_page tools.
   */
  async extractPage(
    url: string,
  ): Promise<Result<{ text: string; links: string[] }, Error>> {
    // Navigate first
    const navResult = await this.navigate(url);
    if (!navResult.ok) return navResult as unknown as Result<never, Error>;

    // Read page content
    const readResult = await this.executor(
      'mcp__claude-in-chrome__read_page',
      {},
    );

    if (!readResult.ok) {
      return Err(readResult.error);
    }

    const pageData = readResult.value as Record<string, unknown>;
    const text =
      typeof pageData['text'] === 'string'
        ? pageData['text']
        : JSON.stringify(pageData);

    // Extract links from page text
    const linkPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const links = text.match(linkPattern) ?? [];

    return Ok({
      text,
      links: [...new Set(links)],
    });
  }

  /**
   * Navigate to a URL and fill form fields.
   * Uses navigate + form_input tools.
   */
  async fillForm(
    url: string,
    fields: Record<string, string>,
  ): Promise<Result<void, Error>> {
    const navResult = await this.navigate(url);
    if (!navResult.ok) return navResult;

    for (const [selector, value] of Object.entries(fields)) {
      const fillResult = await this.executor(
        'mcp__claude-in-chrome__form_input',
        { selector, value },
      );

      if (!fillResult.ok) {
        return Err(fillResult.error);
      }
    }

    return Ok(undefined);
  }

  /**
   * Execute JavaScript in the browser context.
   */
  async executeJS(code: string): Promise<Result<string, Error>> {
    const result = await this.executor(
      'mcp__claude-in-chrome__javascript_tool',
      { code },
    );

    if (!result.ok) {
      return Err(result.error);
    }

    const value = result.value;
    return Ok(typeof value === 'string' ? value : JSON.stringify(value));
  }
}
