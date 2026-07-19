/**
 * API Endpoint Inventory Invariant
 *
 * Guards the public REST surface. If anyone — human or agent — adds, removes,
 * or renames an `onRequest` endpoint in `router.ts`, this test fails until the
 * manifest below is updated deliberately. That makes endpoint drift a conscious
 * decision rather than a silent one.
 *
 * This is the unit-test backbone of the `api-endpoints` gauntlet target
 * (.agent/test_ledger/departments_test_config.json → "api-endpoints").
 */

import { describe, it, expect } from 'vitest';
import * as admin from 'firebase-admin';

// Mock Firebase Admin so importing the router doesn't touch live credentials.
import { vi } from 'vitest';
vi.mock('firebase-admin', () => ({
  firestore: () => ({ collection: vi.fn() }),
  auth: () => ({ verifyIdToken: vi.fn(), getUser: vi.fn() }),
}));

import * as router from '../router';

/**
 * The canonical public REST surface. Keep this in lockstep with router.ts.
 * Update intentionally when an endpoint is genuinely added or removed.
 */
const EXPECTED_ENDPOINTS = [
  'getTrack',
  'createTrack',
  'queryAnalytics',
  'updateTrack',
  'deleteTrack',
  'listTracks',
  'createDistribution',
  'getDistribution',
  'submitDistribution',
  'getProfile',
  'health',
] as const;

/** An exported endpoint is an onRequest handler — a callable function export. */
function exportedEndpoints(): string[] {
  return Object.keys(router)
    .filter((name) => typeof (router as Record<string, unknown>)[name] === 'function')
    .sort();
}

describe('API Endpoint Inventory', () => {
  it('exports exactly the endpoints in the manifest (no silent drift)', () => {
    const actual = exportedEndpoints();
    const expected = [...EXPECTED_ENDPOINTS].sort();

    const added = actual.filter((n) => !expected.includes(n as typeof EXPECTED_ENDPOINTS[number]));
    const removed = expected.filter((n) => !actual.includes(n));

    expect(
      added,
      `New endpoint(s) found in router.ts not in the manifest: ${added.join(', ')}. ` +
        `Add them to EXPECTED_ENDPOINTS (and document the new public surface).`,
    ).toEqual([]);

    expect(
      removed,
      `Manifest endpoint(s) missing from router.ts: ${removed.join(', ')}. ` +
        `If removed deliberately, delete them from EXPECTED_ENDPOINTS.`,
    ).toEqual([]);
  });

  it('every manifested endpoint is an exported function', () => {
    for (const name of EXPECTED_ENDPOINTS) {
      expect(
        typeof (router as Record<string, unknown>)[name],
        `Endpoint "${name}" must be an exported onRequest handler`,
      ).toBe('function');
    }
  });

  it('health endpoint is present (liveness probe must never be dropped)', () => {
    expect(exportedEndpoints()).toContain('health');
  });

  // Keeps the admin import referenced so the mock above is unambiguous to readers.
  it('imports the router without touching live Firebase credentials', () => {
    expect(admin).toBeDefined();
    expect(exportedEndpoints().length).toBeGreaterThan(0);
  });
});
