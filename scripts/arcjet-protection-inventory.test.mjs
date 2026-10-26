import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSource, renderInventory } from './arcjet-protection-inventory.mjs';

const imports = `
import { onCall, onRequest as http } from 'firebase-functions/v2/https';
import { protectAuthenticatedApiRequest as protect } from './functions/security/arcjet';
import { arcjetKey as key } from './config/secrets';
`;
const inspect = source => inspectSource(imports + source, 'endpoint.ts');

test('records each boundary independently, including aliased triggers and local helpers', () => {
  const rows = inspect(`
const options = { secrets: [key] };
async function admit(req) { return protect(req); }
const guarded = onCall({ ...options }, async req => { await admit(req); });
const unguarded = http({}, async req => {});
`);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(({ owner, trigger, secret, guard }) => ({ owner, trigger, secret, guard })), [
    { owner: 'guarded', trigger: 'onCall', secret: true, guard: true },
    { owner: 'unguarded', trigger: 'onRequest', secret: false, guard: false },
  ]);
});

test('comments, strings and unused imports cannot establish guard or secret evidence', () => {
  const [row] = inspect(`
// secrets: [key]; protect(request);
const handler = onCall({}, async () => 'protect(request); secrets: [key]');
`);
  assert.equal(row.secret, false);
  assert.equal(row.guard, false);
});

test('does not transfer sibling callback or option references to another boundary', () => {
  const rows = inspect(`
const first = onCall({ secrets: [key] }, async req => protect(req));
const second = onCall({ label: key }, async req => {});
`);
  assert.equal(rows[0].guard, true);
  assert.equal(rows[0].secret, true);
  assert.equal(rows[1].guard, false);
  assert.equal(rows[1].secret, false);
});

test('retains unknown imported handlers as unestablished, without following recursive helpers forever', () => {
  const rows = inspect(`
import { callback, options } from './external';
const imported = onCall(options, callback);
function recur(req) { return recur(req); }
const recursive = onCall({}, recur);
`);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => !row.guard && !row.secret));
});

test('recognizes literal ARCJET_KEY secrets and v1 namespace chains', () => {
  const [row] = inspect(`const legacy = functions.region('us-central1').https.onCall(async req => {});`);
  assert.equal(row.trigger, 'onCall');
  const [literal] = inspect(`const current = onCall({ secrets: ['ARCJET_KEY'] }, async req => {});`);
  assert.equal(literal.secret, true);
});

test('recognizes factory aliases without accepting similarly named unrelated imports', () => {
  const rows = inspect(`
import { defineCallable as callable } from './factory';
import { defineHttps as unrelated } from './unrelated';
const wrapped = callable({}, async req => {});
const ignored = unrelated({}, async req => {});
`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].owner, 'wrapped');
});

test('unrelated guard imports do not establish Arcjet evidence', () => {
  const rows = inspectSource(`
import { onCall } from 'firebase-functions/v2/https';
import { protectAuthenticatedApiRequest } from './other';
const endpoint = onCall({}, req => protectAuthenticatedApiRequest(req));
`, 'endpoint.ts');
  assert.equal(rows[0].guard, false);
});

test('rendered inventory changes when admission evidence changes and preserves limits', () => {
  const missing = renderInventory(inspect('const endpoint = onCall({}, async req => {});'));
  const present = renderInventory(inspect('const endpoint = onCall({ secrets: [key] }, async req => protect(req));'));
  assert.notEqual(missing, present);
  assert.match(missing, /Not established/);
  assert.match(present, /No row is a runtime protection certification/);
  assert.match(present, /ISSUE-1543 remains open/);
});
