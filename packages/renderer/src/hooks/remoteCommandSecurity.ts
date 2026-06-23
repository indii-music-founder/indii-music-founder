/**
 * Remote-command security helpers.
 *
 * The mobile remote lets a phone drive the desktop agent. That makes the
 * command channel a trust boundary: everything arriving from the phone is
 * UNTRUSTED input until validated here. These helpers are pure and fully
 * unit-tested so the validation logic can't silently regress.
 *
 * Design rules:
 *  - Allowlist, never blocklist. A structured command must match a known prefix
 *    AND its payload must validate, or it is rejected.
 *  - Navigation targets must be real ModuleIds (no arbitrary string → setModule).
 *  - Reject is the default. Unknown structured prefixes do nothing.
 */

import { isValidModule, type ModuleId } from '@/core/constants';

/** Structured command prefixes the desktop is willing to act on. */
export const ALLOWED_COMMAND_PREFIXES = [
  '[GENERATE_IMAGE]',
  '[NAVIGATE]',
  '[AGENT_ACTION]',
  '[DAW_CONTROL]',
  '[MEDIA_PLAYBACK]',
  '[SHOW]',
  '[WAKE]',
] as const;

export type AllowedCommandPrefix = (typeof ALLOWED_COMMAND_PREFIXES)[number];

export type ParsedRemoteCommand =
  | { kind: 'chat'; text: string }
  | { kind: 'navigate'; module: ModuleId }
  | { kind: 'generate_image'; prompt: string }
  | { kind: 'agent_action'; action: string }
  | { kind: 'daw_control'; action: string }
  | { kind: 'media_playback'; action: string }
  | { kind: 'show' }
  | { kind: 'wake' }
  | { kind: 'rejected'; reason: string };

/**
 * Validate a phone-supplied navigation target against the ModuleId allowlist.
 * Returns the typed ModuleId or null — callers must NOT cast raw strings.
 */
export function validateNavigationTarget(raw: string): ModuleId | null {
  const target = (raw ?? '').trim();
  if (!target) return null;
  return isValidModule(target) ? target : null;
}

/**
 * Parse an untrusted command string from the phone into a typed, validated
 * instruction. Never throws; malformed input returns a `rejected` result.
 */
export function parseRemoteCommand(rawText: string | undefined | null): ParsedRemoteCommand {
  const text = typeof rawText === 'string' ? rawText : '';

  // Plain text (no structured prefix) → ordinary agent chat.
  if (!text.startsWith('[')) {
    const trimmed = text.trim();
    if (!trimmed) return { kind: 'rejected', reason: 'empty command' };
    return { kind: 'chat', text };
  }

  // Structured command — must match a known prefix exactly.
  const prefix = ALLOWED_COMMAND_PREFIXES.find((p) => text.startsWith(p));
  if (!prefix) {
    return { kind: 'rejected', reason: `unknown command prefix: ${text.slice(0, 24)}` };
  }

  const payload = text.slice(prefix.length).trim();

  switch (prefix) {
    case '[NAVIGATE]': {
      const module = validateNavigationTarget(payload);
      if (!module) return { kind: 'rejected', reason: `invalid navigation target: ${payload || '(empty)'}` };
      return { kind: 'navigate', module };
    }
    case '[GENERATE_IMAGE]': {
      if (!payload) return { kind: 'rejected', reason: 'image prompt is empty' };
      return { kind: 'generate_image', prompt: payload };
    }
    case '[AGENT_ACTION]': {
      if (!payload) return { kind: 'rejected', reason: 'agent action is empty' };
      return { kind: 'agent_action', action: payload };
    }
    case '[DAW_CONTROL]': {
      if (!payload) return { kind: 'rejected', reason: 'DAW control action is empty' };
      return { kind: 'daw_control', action: payload };
    }
    case '[MEDIA_PLAYBACK]': {
      if (!payload) return { kind: 'rejected', reason: 'media playback action is empty' };
      return { kind: 'media_playback', action: payload };
    }
    case '[SHOW]': {
      // No payload required — surfaces the most recent visual artifact on the phone.
      return { kind: 'show' };
    }
    case '[WAKE]': {
      return { kind: 'wake' };
    }
    default:
      // Exhaustiveness guard — unreachable while ALLOWED_COMMAND_PREFIXES is covered.
      return { kind: 'rejected', reason: 'unhandled command prefix' };
  }
}
