import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import {
  ExecutionNodeSchema, IntelligenceObservationSchema, decideIntelligenceIntake, validateExecutionGraph,
  type ExecutionNode, type IntelligenceObservation,
} from '@indii/shared';

export const OPERATIONS_GRAPH_ID = 'indii-music-founder';
const GRAPH_LIMIT = 100;
const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

interface GraphDocument {
  schemaVersion: 'execution-graph.v1';
  nodes: Record<string, ExecutionNode>;
  identityKeys: Record<string, string[]>;
  revision: number;
}

export function createObservedIssueNode(issueUrl: string, bugId: string, observedAt: number): ExecutionNode {
  const url = new URL(issueUrl);
  if (url.origin !== 'https://github.com' || !/^\/indii-music-founder\/indii-music-founder\/issues\/[1-9]\d*$/.test(url.pathname) || url.search || url.hash) {
    throw new Error('Bug observations must reference a canonical repository issue.');
  }
  const canonicalUrl = url.href;
  return ExecutionNodeSchema.parse({
    schemaVersion: 'execution-node.v1', id: `github_${digest(canonicalUrl)}`, type: 'observation',
    objective: 'Verify the reported failure against the original GitHub issue before assigning an outcome.',
    source: { system: 'github', key: canonicalUrl },
    provenance: [{ sourceId: `bug_reports/${bugId}`, observedAt }],
    parent: null, children: [], relationships: [], status: 'observed', priority: 'medium', executor: null,
    dependencies: [], blockers: [], evidence: [], acceptanceCriteria: [], attempts: 0,
    cost: { usdMicros: 0, tokens: 0, wallTimeMs: 0 }, createdAt: observedAt, updatedAt: observedAt, terminalOutcome: null,
  });
}

export function mergeIssueObservation(existing: ExecutionNode | undefined, incoming: ExecutionNode): ExecutionNode {
  if (!existing) return incoming;
  if (existing.id !== incoming.id || existing.source.key !== incoming.source.key) throw new Error('Issue identity mismatch.');
  const additions = incoming.provenance.filter(p => !existing.provenance.some(e => e.sourceId === p.sourceId));
  if (!additions.length) return existing;
  if (existing.provenance.length + additions.length > 200) throw new Error('Observation provenance capacity reached; archive before ingesting more.');
  // New observations never reopen/close an issue or copy its description/status into a second tracker.
  return ExecutionNodeSchema.parse({ ...existing, provenance: [...existing.provenance, ...additions], updatedAt: Math.max(existing.updatedAt, incoming.updatedAt) });
}

function readGraph(value: admin.firestore.DocumentData | undefined): GraphDocument {
  if (!value) return { schemaVersion: 'execution-graph.v1', nodes: {}, identityKeys: {}, revision: 0 };
  if (value.schemaVersion !== 'execution-graph.v1' || !Number.isSafeInteger(value.revision) || value.revision < 0 || !value.nodes || !value.identityKeys) {
    throw new Error('Unsupported execution graph document.');
  }
  const graph = value as GraphDocument;
  validateExecutionGraph(graph.nodes);
  if (Object.keys(graph.nodes).length > GRAPH_LIMIT) throw new Error('Execution graph capacity reached.');
  return graph;
}

function validateStoredGraph(graph: GraphDocument): void {
  validateExecutionGraph(graph.nodes);
  // Leave headroom under Firestore's 1 MiB document limit; never silently trim audit evidence.
  if (Buffer.byteLength(JSON.stringify(graph), 'utf8') > 800_000) throw new Error('Execution graph storage capacity reached; partition/archive before further intake.');
  if (graph.revision >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Execution graph revision capacity reached.');
}

/** Replay-safe transaction: graph and intake receipt either both commit or neither commits. */
export async function persistBugGraphObservation(bugId: string, issueUrl: string, observedAt: number): Promise<void> {
  const incoming = createObservedIssueNode(issueUrl, bugId, observedAt);
  const db = admin.firestore();
  const graphRef = db.collection('executionGraphs').doc(OPERATIONS_GRAPH_ID);
  const receiptRef = graphRef.collection('intakeReceipts').doc(`bug_${digest(bugId)}`);
  await db.runTransaction(async tx => {
    const [snapshot, receipt] = await tx.getAll(graphRef, receiptRef);
    if (receipt.exists) return;
    const graph = readGraph(snapshot.data());
    if (!graph.nodes[incoming.id] && Object.keys(graph.nodes).length >= GRAPH_LIMIT) throw new Error('Execution graph capacity reached.');
    graph.nodes[incoming.id] = mergeIssueObservation(graph.nodes[incoming.id], incoming);
    graph.identityKeys[incoming.id] = [issueUrl];
    validateStoredGraph(graph);
    tx.set(graphRef, { ...graph, revision: graph.revision + 1 });
    tx.create(receiptRef, { source: `bug_reports/${bugId}`, nodeId: incoming.id, observedAt, modelCalls: 0 });
  });
}

/** Server-only intelligence sources write observations; clients cannot set relevance/actionability. */
export async function persistIntelligenceIntake(input: IntelligenceObservation): Promise<void> {
  const observation = IntelligenceObservationSchema.parse(input);
  const db = admin.firestore();
  const graphRef = db.collection('executionGraphs').doc(OPERATIONS_GRAPH_ID);
  const receiptRef = graphRef.collection('intakeReceipts').doc(`intelligence_${digest(observation.id)}`);
  await db.runTransaction(async tx => {
    const [snapshot, receipt] = await tx.getAll(graphRef, receiptRef);
    if (receipt.exists) return;
    const graph = readGraph(snapshot.data());
    const targets = Object.values(graph.nodes).map(node => ({ id: node.id, identityKeys: graph.identityKeys[node.id] ?? [node.source.key] }));
    const decision = decideIntelligenceIntake(observation, targets);
    if (decision.decision === 'ACT') {
      if (Object.keys(graph.nodes).length >= GRAPH_LIMIT) throw new Error('Execution graph capacity reached.');
      const id = `intelligence_${digest(observation.id)}`;
      graph.nodes[id] = ExecutionNodeSchema.parse({
        schemaVersion: 'execution-node.v1', id, type: 'job', objective: observation.objective,
        source: { system: 'intelligence', key: observation.sourceUri },
        provenance: [{ sourceId: observation.sourceUri, observedAt: observation.observedAt }],
        parent: null, children: [], relationships: [], status: 'planned', priority: 'medium', executor: null,
        dependencies: [], blockers: ['Acceptance criteria and executor authorization required.'], evidence: [], acceptanceCriteria: [], attempts: 0,
        cost: { usdMicros: 0, tokens: 0, wallTimeMs: 0 }, createdAt: observation.observedAt, updatedAt: observation.observedAt, terminalOutcome: null,
      });
      graph.identityKeys[id] = observation.identityKeys;
    } else if (decision.decision === 'ATTACH') {
      // Evidence is only a pointer. An industry discovery does not prove implementation or completion.
      for (const id of decision.targetIds) {
        const node = graph.nodes[id];
        if (!node.provenance.some(p => p.sourceId === observation.sourceUri)) {
          if (node.provenance.length >= 200) throw new Error('Node provenance capacity reached.');
          graph.nodes[id] = ExecutionNodeSchema.parse({ ...node, provenance: [...node.provenance, { sourceId: observation.sourceUri, observedAt: observation.observedAt }], updatedAt: Math.max(node.updatedAt, observation.observedAt) });
        }
        graph.identityKeys[id] = [...new Set([...(graph.identityKeys[id] ?? []), ...observation.identityKeys])];
        if (graph.identityKeys[id].length > 100) throw new Error('Node identity capacity reached.');
      }
    }
    validateStoredGraph(graph);
    if (['ACT', 'ATTACH'].includes(decision.decision)) tx.set(graphRef, { ...graph, revision: graph.revision + 1 });
    tx.create(receiptRef, { observation, ...decision });
  });
}

export const ingestBugExecutionGraph = onDocumentWritten(
  { document: 'bug_reports/{bugId}', region: 'us-central1', memory: '512MiB', retry: true },
  async event => {
    const report = event.data?.after.data();
    if (!report?.issueUrl || !['ok', 'merged_as_comment'].includes(report.githubStatus)) return;
    const observedAt = Date.parse(report.reportedAt);
    if (!Number.isSafeInteger(observedAt) || observedAt < 0) throw new Error('Bug observation has no valid report timestamp.');
    await persistBugGraphObservation(event.params.bugId, report.issueUrl, observedAt);
  },
);

export const ingestExecutionIntelligence = onDocumentWritten(
  { document: 'executionIntelligence/{observationId}', region: 'us-central1', memory: '512MiB', retry: true },
  async event => {
    const data = event.data?.after.data();
    if (!data) return;
    // Source observations are immutable: reuse the document id for retry, a new id for new evidence.
    if (data.id !== event.params.observationId) throw new Error('Intelligence document identity mismatch.');
    await persistIntelligenceIntake(IntelligenceObservationSchema.parse(data));
  },
);
