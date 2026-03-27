import { describe, it, expect } from 'vitest';
import {
  researchAgentHooks,
  securityHooks,
  ciHooks,
  generateSettingsJson,
  mergeProfiles,
} from '../src/hooks/profiles.js';

describe('Hook Profiles', () => {
  it('research profile has PostToolUse and PreToolUse hooks', () => {
    expect(researchAgentHooks.PostToolUse).toBeDefined();
    expect(researchAgentHooks.PreToolUse).toBeDefined();
    expect(researchAgentHooks.SubagentStop).toBeDefined();
  });

  it('security profile blocks internal IPs', () => {
    const preToolUse = securityHooks.PreToolUse;
    expect(preToolUse).toBeDefined();
    expect(preToolUse!.length).toBeGreaterThan(0);

    const bashHook = preToolUse!.find((r) => r.matcher === 'Bash');
    expect(bashHook).toBeDefined();

    const command = bashHook!.hooks[0]!;
    expect(command.type).toBe('command');
    if (command.type === 'command') {
      expect(command.command).toContain('127');
      expect(command.command).toContain('192');
      expect(command.command).toContain('exit 2');
    }
  });

  it('CI profile enforces structured output on Stop', () => {
    expect(ciHooks.Stop).toBeDefined();
    expect(ciHooks.PostToolUse).toBeDefined();
  });
});

describe('Settings Generation', () => {
  it('generates valid JSON settings', () => {
    const json = generateSettingsJson(researchAgentHooks);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed).toHaveProperty('hooks');
    expect(parsed['hooks']).toHaveProperty('PostToolUse');
    expect(parsed['hooks']).toHaveProperty('PreToolUse');
  });
});

describe('Profile Merging', () => {
  it('merges multiple profiles', () => {
    const merged = mergeProfiles(researchAgentHooks, securityHooks);

    // Both profiles have PreToolUse — should combine
    expect(merged.PreToolUse!.length).toBe(
      (researchAgentHooks.PreToolUse?.length ?? 0) +
        (securityHooks.PreToolUse?.length ?? 0),
    );
  });

  it('preserves events from all profiles', () => {
    const merged = mergeProfiles(researchAgentHooks, ciHooks);

    // SubagentStop only in research
    expect(merged.SubagentStop).toBeDefined();
    // Stop in both
    expect(merged.Stop!.length).toBe(
      (researchAgentHooks.Stop?.length ?? 0) +
        (ciHooks.Stop?.length ?? 0),
    );
  });
});
