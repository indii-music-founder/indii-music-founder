/**
 * Remote-command security tests.
 *
 * The mobile remote is a trust boundary: the phone is untrusted and can send
 * arbitrary strings that drive the desktop. These tests pin the validation so
 * the channel can't be used to navigate to bogus screens, smuggle unknown
 * structured commands, or act on empty payloads.
 */

import { describe, it, expect } from 'vitest';
import {
  parseRemoteCommand,
  validateNavigationTarget,
  ALLOWED_COMMAND_PREFIXES,
} from './remoteCommandSecurity';
import { isValidModule } from '@/core/constants';

describe('validateNavigationTarget', () => {
  it('accepts a real ModuleId', () => {
    expect(validateNavigationTarget('creative')).toBe('creative');
    expect(validateNavigationTarget('dashboard')).toBe('dashboard');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateNavigationTarget('  marketing  ')).toBe('marketing');
  });

  it('rejects an unknown / bogus module (no arbitrary navigation)', () => {
    expect(validateNavigationTarget('totally-made-up')).toBeNull();
    expect(validateNavigationTarget('../../etc/passwd')).toBeNull();
    expect(validateNavigationTarget('<script>alert(1)</script>')).toBeNull();
  });

  it('rejects empty / whitespace / nullish targets', () => {
    expect(validateNavigationTarget('')).toBeNull();
    expect(validateNavigationTarget('   ')).toBeNull();
    expect(validateNavigationTarget(undefined as unknown as string)).toBeNull();
  });

  it('only returns values that pass the canonical isValidModule allowlist', () => {
    const result = validateNavigationTarget('legal');
    expect(result).not.toBeNull();
    expect(isValidModule(result!)).toBe(true);
  });
});

describe('parseRemoteCommand — plain chat', () => {
  it('treats non-prefixed text as agent chat', () => {
    expect(parseRemoteCommand('hello, write me a bio')).toEqual({
      kind: 'chat',
      text: 'hello, write me a bio',
    });
  });

  it('rejects empty / whitespace-only chat', () => {
    expect(parseRemoteCommand('   ').kind).toBe('rejected');
    expect(parseRemoteCommand('').kind).toBe('rejected');
    expect(parseRemoteCommand(null).kind).toBe('rejected');
    expect(parseRemoteCommand(undefined).kind).toBe('rejected');
  });
});

describe('parseRemoteCommand — structured commands (allowlist)', () => {
  it('parses a valid navigation command', () => {
    expect(parseRemoteCommand('[NAVIGATE] workflow')).toEqual({
      kind: 'navigate',
      module: 'workflow',
    });
  });

  it('rejects navigation to an invalid module', () => {
    const r = parseRemoteCommand('[NAVIGATE] rm -rf /');
    expect(r.kind).toBe('rejected');
  });

  it('rejects an empty navigation target', () => {
    expect(parseRemoteCommand('[NAVIGATE]').kind).toBe('rejected');
  });

  it('parses image generation with a prompt', () => {
    expect(parseRemoteCommand('[GENERATE_IMAGE] a neon album cover')).toEqual({
      kind: 'generate_image',
      prompt: 'a neon album cover',
    });
  });

  it('rejects image generation with no prompt', () => {
    expect(parseRemoteCommand('[GENERATE_IMAGE]   ').kind).toBe('rejected');
  });

  it('parses video generation with a prompt', () => {
    expect(parseRemoteCommand('[GENERATE_VIDEO] a cinematic performance clip')).toEqual({
      kind: 'generate_video',
      prompt: 'a cinematic performance clip',
    });
  });

  it('rejects video generation with no prompt', () => {
    expect(parseRemoteCommand('[GENERATE_VIDEO]   ').kind).toBe('rejected');
  });

  it('parses an agent action with a payload', () => {
    expect(parseRemoteCommand('[AGENT_ACTION] run-release-checklist')).toEqual({
      kind: 'agent_action',
      action: 'run-release-checklist',
    });
  });

  it('rejects an empty agent action', () => {
    expect(parseRemoteCommand('[AGENT_ACTION]').kind).toBe('rejected');
  });

  it('parses daw control command', () => {
    expect(parseRemoteCommand('[DAW_CONTROL] toggle_playback')).toEqual({
      kind: 'daw_control',
      action: 'toggle_playback',
    });
    expect(parseRemoteCommand('[DAW_CONTROL] play')).toEqual({
      kind: 'daw_control',
      action: 'play',
    });
  });

  it('rejects empty daw control action', () => {
    expect(parseRemoteCommand('[DAW_CONTROL]').kind).toBe('rejected');
    expect(parseRemoteCommand('[DAW_CONTROL]   ').kind).toBe('rejected');
  });

  it('parses media playback command', () => {
    expect(parseRemoteCommand('[MEDIA_PLAYBACK] pause')).toEqual({
      kind: 'media_playback',
      action: 'pause',
    });
    expect(parseRemoteCommand('[MEDIA_PLAYBACK] play')).toEqual({
      kind: 'media_playback',
      action: 'play',
    });
    expect(parseRemoteCommand('[MEDIA_PLAYBACK] stop')).toEqual({
      kind: 'media_playback',
      action: 'stop',
    });
  });

  it('rejects empty media playback action', () => {
    expect(parseRemoteCommand('[MEDIA_PLAYBACK]').kind).toBe('rejected');
    expect(parseRemoteCommand('[MEDIA_PLAYBACK]   ').kind).toBe('rejected');
  });

  it('parses wake command', () => {
    expect(parseRemoteCommand('[WAKE]')).toEqual({
      kind: 'wake',
    });
  });

  it('rejects an unknown structured prefix (default-deny)', () => {
    const r = parseRemoteCommand('[EXEC] shutdown now');
    expect(r.kind).toBe('rejected');
    if (r.kind === 'rejected') expect(r.reason).toContain('unknown command prefix');
  });

  it('does not treat a known prefix as a substring match elsewhere', () => {
    // Prefix must be at the START; a bracket later in the text is just chat.
    expect(parseRemoteCommand('please use [NAVIGATE] later').kind).toBe('chat');
  });

  it('every allowlisted prefix is handled (no prefix falls through to reject-unknown)', () => {
    for (const prefix of ALLOWED_COMMAND_PREFIXES) {
      const r = parseRemoteCommand(prefix === '[WAKE]' ? prefix : `${prefix} creative`);
      // None should be rejected as "unknown prefix".
      if (r.kind === 'rejected') {
        expect(r.reason).not.toContain('unknown command prefix');
      }
    }
  });
});
