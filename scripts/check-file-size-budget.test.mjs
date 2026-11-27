#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFileSizeBudget } from './check-file-size-budget.mjs';

test('passes when all files are within limit and allowlisted files stay at or below cap', () => {
    const result = evaluateFileSizeBudget(
        {
            'packages/renderer/src/a.ts': 250,
            'packages/renderer/src/big.ts': 1400,
        },
        {
            'packages/renderer/src/big.ts': 1500,
        },
        1000,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.newOversized, []);
    assert.deepEqual(result.grew, []);
    assert.deepEqual(result.stale, []);
});

test('fails when a non-allowlisted file exceeds the limit', () => {
    const result = evaluateFileSizeBudget(
        {
            'packages/renderer/src/newBig.ts': 1001,
        },
        {},
        1000,
    );

    assert.equal(result.ok, false);
    assert.equal(result.newOversized.length, 1);
    assert.equal(result.newOversized[0].path, 'packages/renderer/src/newBig.ts');
    assert.equal(result.newOversized[0].lines, 1001);
});

test('fails when an allowlisted file grows beyond its recorded cap', () => {
    const result = evaluateFileSizeBudget(
        {
            'packages/renderer/src/big.ts': 1501,
        },
        {
            'packages/renderer/src/big.ts': 1500,
        },
        1000,
    );

    assert.equal(result.ok, false);
    assert.equal(result.grew.length, 1);
    assert.equal(result.grew[0].path, 'packages/renderer/src/big.ts');
    assert.equal(result.grew[0].lines, 1501);
    assert.equal(result.grew[0].maxLines, 1500);
});

test('fails when an allowlisted file shrinks to or below the limit or is deleted', () => {
    const result = evaluateFileSizeBudget(
        {
            'packages/renderer/src/shrunk.ts': 1000,
        },
        {
            'packages/renderer/src/shrunk.ts': 1200,
            'packages/renderer/src/deleted.ts': 1300,
        },
        1000,
    );

    assert.equal(result.ok, false);
    assert.equal(result.stale.length, 2);
    assert.deepEqual(
        result.stale.map((s) => ({ path: s.path, reason: s.reason })),
        [
            { path: 'packages/renderer/src/shrunk.ts', reason: 'now_within_limit' },
            { path: 'packages/renderer/src/deleted.ts', reason: 'deleted' },
        ],
    );
});
