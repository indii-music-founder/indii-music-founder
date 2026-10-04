// Structural integration only: genuine Firestore emulator transactions, no customer/authentication simulation.
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== 'demo-indii-execution-graph') {
    throw new Error('This check requires the isolated demo-indii-execution-graph Firestore emulator.');
  }
  admin.initializeApp({ projectId: 'demo-indii-execution-graph' });
  const { persistBugGraphObservation, persistIntelligenceIntake, OPERATIONS_GRAPH_ID } = require('../packages/firebase/lib/functions/agent/executionGraphStore.js');
  const graphRef = admin.firestore().collection('executionGraphs').doc(OPERATIONS_GRAPH_ID);
  const issueUrl = 'https://github.com/indii-music-founder/indii-music-founder/issues/356';
  await Promise.all([
    persistBugGraphObservation('transaction-check-a', issueUrl, 1),
    persistBugGraphObservation('transaction-check-b', issueUrl, 2),
  ]);
  await persistBugGraphObservation('transaction-check-a', issueUrl, 1);
  let graph = (await graphRef.get()).data();
  assert.equal(Object.keys(graph.nodes).length, 1);
  assert.equal(graph.revision, 2);
  assert.equal(Object.values(graph.nodes)[0].provenance.length, 2);

  const observation = { id: 'intake-check-a', sourceUri: 'https://example.org/change-a', observedAt: 3, relevant: true, actionable: true, objective: 'Review a changed capability contract.', identityKeys: ['capability:contract-check'] };
  await Promise.all([
    persistIntelligenceIntake(observation),
    persistIntelligenceIntake({ ...observation, id: 'intake-check-b', sourceUri: 'https://example.org/change-b' }),
  ]);
  await persistIntelligenceIntake(observation);
  graph = (await graphRef.get()).data();
  assert.equal(Object.keys(graph.nodes).length, 2, 'Concurrent same-capability discoveries must not create two jobs.');
  assert.equal(graph.revision, 4, 'Replays must not increment graph revision.');
  const job = Object.values(graph.nodes).find(n => n.type === 'job');
  assert.equal(job.status, 'planned');
  assert.equal(job.terminalOutcome, null);
  assert.equal(job.provenance.length, 2);
  assert.equal(job.cost.tokens, 0);
  await persistIntelligenceIntake({ ...observation, id: 'ignore-check', relevant: false });
  await persistIntelligenceIntake({ ...observation, id: 'watch-check', actionable: false, identityKeys: ['unmatched:watch'] });
  const after = (await graphRef.get()).data();
  assert.deepEqual(after, graph, 'IGNORE/WATCH must not expand or rewrite graph work.');
  const receipts = (await graphRef.collection('intakeReceipts').get()).docs.map(d => d.data());
  assert.equal(receipts.length, 6);
  assert.deepEqual(receipts.filter(r => r.decision).map(r => r.decision).sort(), ['ACT', 'ATTACH', 'IGNORE', 'WATCH']);
  assert.equal(receipts.every(r => r.modelCalls === 0), true);
  console.log('PASS: atomic graph/receipt persistence, concurrent deduplication, replay, all four gates, no model calls. Structural emulator evidence only.');
  await admin.app().delete();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
