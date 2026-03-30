import { describe, it, expect } from 'vitest';
import { HeadlessRunner } from '../src/dispatch/cli.js';
import { ActionsDispatcher } from '../src/dispatch/actions.js';
import { SlackDispatcher } from '../src/dispatch/slack.js';
import { ChromeDispatcher, type McpToolExecutor } from '../src/dispatch/chrome.js';
import { Ok, Err } from '../src/types/core.js';

// ─── HeadlessRunner tests ───────────────────────────────────────────────────

describe('HeadlessRunner', () => {
  it('should build command with basic options', () => {
    const runner = new HeadlessRunner({ timeout: 60000 });

    const args = runner.buildCommand('Analyze this', {});
    expect(args).toContain('-p');
    expect(args).toContain('Analyze this');
  });

  it('should include model flag', () => {
    const runner = new HeadlessRunner();
    const args = runner.buildCommand('test', { model: 'claude-sonnet-4-6' });
    expect(args).toContain('--model');
    expect(args).toContain('claude-sonnet-4-6');
  });

  it('should include allowed tools', () => {
    const runner = new HeadlessRunner();
    const args = runner.buildCommand('test', {
      allowedTools: ['Read', 'Bash'],
    });
    expect(args).toContain('--allowedTools');
    expect(args).toContain('Read');
    expect(args).toContain('Bash');
  });

  it('should use stream-json for json output format', () => {
    const runner = new HeadlessRunner();
    const args = runner.buildCommand('test', { outputFormat: 'json' });
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
  });

  it('should not include output format for text', () => {
    const runner = new HeadlessRunner();
    const args = runner.buildCommand('test', { outputFormat: 'text' });
    expect(args).not.toContain('--output-format');
  });

  it('should build full command with all options', () => {
    const runner = new HeadlessRunner();
    const args = runner.buildCommand('Do the thing', {
      model: 'claude-opus-4-6',
      allowedTools: ['Read', 'Write', 'Bash'],
      outputFormat: 'json',
    });

    expect(args).toContain('-p');
    expect(args).toContain('Do the thing');
    expect(args).toContain('--model');
    expect(args).toContain('claude-opus-4-6');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
    // 3 tools = 3 --allowedTools flags
    const toolFlags = args.filter((a) => a === '--allowedTools');
    expect(toolFlags).toHaveLength(3);
  });
});

// ─── ActionsDispatcher tests ────────────────────────────────────────────────

describe('ActionsDispatcher', () => {
  it('should be constructible', () => {
    const dispatcher = new ActionsDispatcher();
    expect(dispatcher).toBeDefined();
    expect(typeof dispatcher.triggerWorkflow).toBe('function');
    expect(typeof dispatcher.monitorRun).toBe('function');
    expect(typeof dispatcher.getArtifacts).toBe('function');
  });
});

// ─── SlackDispatcher tests ──────────────────────────────────────────────────

describe('SlackDispatcher', () => {
  it('should construct with webhook URL', () => {
    const slack = new SlackDispatcher('https://hooks.slack.com/test');
    expect(slack).toBeDefined();
  });

  // Note: actual webhook calls are integration tests.
  // We test the public API surface.
  it('should expose all posting methods', () => {
    const slack = new SlackDispatcher('https://hooks.slack.com/test');
    expect(typeof slack.postDispatchRequest).toBe('function');
    expect(typeof slack.postResult).toBe('function');
    expect(typeof slack.postQualityAlert).toBe('function');
    expect(typeof slack.postRoundSummary).toBe('function');
  });
});

// ─── ChromeDispatcher tests ─────────────────────────────────────────────────

describe('ChromeDispatcher', () => {
  it('should navigate using MCP tool executor', async () => {
    const mockExecutor: McpToolExecutor = async (toolName, input) => {
      expect(toolName).toBe('mcp__claude-in-chrome__navigate');
      expect(input['url']).toBe('https://example.com');
      return Ok({ success: true });
    };

    const chrome = new ChromeDispatcher(mockExecutor);
    const result = await chrome.navigate('https://example.com');
    expect(result.ok).toBe(true);
  });

  it('should extract page content', async () => {
    let callCount = 0;
    const mockExecutor: McpToolExecutor = async (toolName, _input) => {
      callCount++;
      if (toolName === 'mcp__claude-in-chrome__navigate') {
        return Ok({ success: true });
      }
      if (toolName === 'mcp__claude-in-chrome__read_page') {
        return Ok({
          text: 'Page content with https://example.com/link',
        });
      }
      return Err(new Error(`Unknown tool: ${toolName}`));
    };

    const chrome = new ChromeDispatcher(mockExecutor);
    const result = await chrome.extractPage('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toContain('Page content');
      expect(result.value.links).toContain('https://example.com/link');
    }
    expect(callCount).toBe(2);
  });

  it('should fill form fields', async () => {
    const calls: string[] = [];
    const mockExecutor: McpToolExecutor = async (toolName, _input) => {
      calls.push(toolName);
      return Ok({ success: true });
    };

    const chrome = new ChromeDispatcher(mockExecutor);
    const result = await chrome.fillForm('https://example.com/form', {
      '#name': 'John',
      '#email': 'john@example.com',
    });

    expect(result.ok).toBe(true);
    // navigate + 2 form_input calls
    expect(calls).toHaveLength(3);
    expect(calls[0]).toBe('mcp__claude-in-chrome__navigate');
    expect(calls[1]).toBe('mcp__claude-in-chrome__form_input');
    expect(calls[2]).toBe('mcp__claude-in-chrome__form_input');
  });

  it('should execute JavaScript', async () => {
    const mockExecutor: McpToolExecutor = async (toolName, input) => {
      expect(toolName).toBe('mcp__claude-in-chrome__javascript_tool');
      expect(input['code']).toBe('document.title');
      return Ok('My Page Title');
    };

    const chrome = new ChromeDispatcher(mockExecutor);
    const result = await chrome.executeJS('document.title');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('My Page Title');
    }
  });

  it('should propagate errors from executor', async () => {
    const mockExecutor: McpToolExecutor = async () => {
      return Err(new Error('Chrome not connected'));
    };

    const chrome = new ChromeDispatcher(mockExecutor);
    const result = await chrome.navigate('https://example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Chrome not connected');
    }
  });
});
