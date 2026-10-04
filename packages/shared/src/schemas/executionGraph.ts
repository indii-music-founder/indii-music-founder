import { z } from 'zod';

const Id = z.string().regex(/^[a-zA-Z0-9:_-]{1,200}$/);
const Time = z.number().int().nonnegative().safe();
export const ExecutionEvidenceSchema = z.object({
  id: Id,
  kind: z.enum(['implementation', 'test', 'ci', 'runtime', 'external', 'reproduction', 'source', 'decision']),
  uri: z.string().url().max(2048),
  artifactIdentity: z.string().min(1).max(200),
  observedAt: Time,
  result: z.enum(['pass', 'fail', 'unverified']),
  authority: z.enum(['repository', 'deterministic-check', 'external-service', 'human', 'model']),
}).strict();
export type ExecutionEvidence = z.infer<typeof ExecutionEvidenceSchema>;

export const ExecutionNodeSchema = z.object({
  schemaVersion: z.literal('execution-node.v1'),
  id: Id,
  type: z.enum(['observation', 'problem', 'job', 'verification', 'outcome', 'program']),
  objective: z.string().trim().min(1).max(4000),
  source: z.object({ system: z.enum(['github', 'bug-report', 'intelligence', 'internal']), key: z.string().min(1).max(2048) }).strict(),
  provenance: z.array(z.object({ sourceId: z.string().min(1).max(2048), observedAt: Time }).strict()).max(200),
  parent: Id.nullable(),
  children: z.array(Id).max(200),
  relationships: z.array(z.object({
    type: z.enum(['spawned-by', 'depends-on', 'blocks', 'overlaps', 'duplicates', 'validates', 'supersedes', 'converges-to']),
    target: Id,
    evidenceIds: z.array(Id).max(100),
  }).strict()).max(200),
  status: z.enum(['observed', 'planned', 'executing', 'awaiting-verification', 'blocked', 'completed', 'failed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  executor: z.string().min(1).max(200).nullable(),
  dependencies: z.array(Id).max(200),
  blockers: z.array(z.string().min(1).max(1000)).max(100),
  evidence: z.array(ExecutionEvidenceSchema).max(200),
  acceptanceCriteria: z.array(z.object({
    id: Id, description: z.string().min(1).max(1000),
    requiredEvidence: z.array(ExecutionEvidenceSchema.shape.kind).min(1).max(8),
    artifactIdentity: z.string().min(1).max(200),
    evidenceIds: z.array(Id).max(100),
  }).strict()).max(100),
  attempts: z.number().int().nonnegative(),
  cost: z.object({ usdMicros: z.number().int().nonnegative(), tokens: z.number().int().nonnegative(), wallTimeMs: Time }).strict(),
  createdAt: Time,
  updatedAt: Time,
  terminalOutcome: z.enum(['verified', 'failed', 'cancelled']).nullable(),
}).strict().superRefine((node, ctx) => {
  if (node.updatedAt < node.createdAt) ctx.addIssue({ code: 'custom', message: 'updatedAt precedes createdAt.' });
  if (node.parent === node.id || node.children.includes(node.id) || node.dependencies.includes(node.id) || node.relationships.some(r => r.target === node.id)) {
    ctx.addIssue({ code: 'custom', message: 'A node cannot relate to itself.' });
  }
  for (const ids of [node.children, node.dependencies, node.evidence.map(e => e.id), node.acceptanceCriteria.map(c => c.id)]) {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate graph identifiers.' });
  }
  const terminal = ['completed', 'failed', 'cancelled'].includes(node.status);
  const expected = { completed: 'verified', failed: 'failed', cancelled: 'cancelled' }[node.status as 'completed' | 'failed' | 'cancelled'];
  if (terminal ? node.terminalOutcome !== expected : node.terminalOutcome !== null) {
    ctx.addIssue({ code: 'custom', message: 'Status and terminal outcome disagree.' });
  }
  if (node.status === 'completed') {
    if (node.blockers.length || !node.acceptanceCriteria.length || node.acceptanceCriteria.some(c => !criterionSatisfied(c, node.evidence))) {
      ctx.addIssue({ code: 'custom', message: 'Completion requires authoritative evidence for every acceptance criterion and no blockers.' });
    }
  }
});
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;

function criterionSatisfied(criterion: { requiredEvidence: ExecutionEvidence['kind'][]; artifactIdentity: string; evidenceIds: string[] }, evidence: ExecutionEvidence[]): boolean {
  return criterion.requiredEvidence.every(kind => evidence.some(item =>
    criterion.evidenceIds.includes(item.id) && item.kind === kind && item.artifactIdentity === criterion.artifactIdentity
    && item.result === 'pass' && item.authority !== 'model'));
}

/** Missing dependencies fail closed. Duplicate/overlap links never satisfy a dependency. */
export function verifyExecutionNode(node: ExecutionNode, nodes: Readonly<Record<string, ExecutionNode>>): string[] {
  const errors: string[] = [];
  if (!node.acceptanceCriteria.length) errors.push('No acceptance criteria.');
  if (node.blockers.length) errors.push(...node.blockers);
  for (const id of [...new Set([...node.dependencies, ...node.children, ...node.relationships.filter(r => r.type === 'depends-on').map(r => r.target)])]) {
    const dependency = nodes[id];
    if (!dependency || !ExecutionNodeSchema.safeParse(dependency).success || dependency.status !== 'completed') errors.push(`Unverified dependency: ${id}`);
  }
  for (const criterion of node.acceptanceCriteria) {
    if (!criterionSatisfied(criterion, node.evidence)) errors.push(`Missing authoritative evidence: ${criterion.id}`);
  }
  return errors;
}

/** Whole-graph validation is required at persistence boundaries, including cycle detection. */
export function validateExecutionGraph(nodes: Readonly<Record<string, ExecutionNode>>): void {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Cyclic dependency: ${id}`);
    if (visited.has(id)) return;
    const node = nodes[id];
    if (!node) throw new Error(`Missing graph node: ${id}`);
    ExecutionNodeSchema.parse(node);
    if (id !== node.id) throw new Error('Graph key differs from node identity.');
    visiting.add(id);
    const dependencyIds = [...node.dependencies, ...node.children, ...node.relationships.filter(r => r.type === 'depends-on').map(r => r.target)];
    for (const dependency of dependencyIds) visit(dependency);
    for (const target of [node.parent, ...node.children, ...node.relationships.map(r => r.target)].filter((v): v is string => v !== null)) {
      if (!nodes[target]) throw new Error(`Missing graph node: ${target}`);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of Object.keys(nodes)) visit(id);
  for (const node of Object.values(nodes)) {
    const ancestors = new Set<string>([node.id]);
    let parent = node.parent;
    while (parent) {
      if (ancestors.has(parent)) throw new Error('Cyclic parent lineage.');
      ancestors.add(parent);
      parent = nodes[parent].parent;
    }
    if (node.parent && !nodes[node.parent].children.includes(node.id)) throw new Error('Parent/child lineage is not reciprocal.');
    if (node.children.some(id => nodes[id].parent !== node.id)) throw new Error('Parent/child lineage is not reciprocal.');
    if (node.status === 'completed' && verifyExecutionNode(node, nodes).length) throw new Error(`Unverified completion: ${node.id}`);
  }
}

export const IntelligenceObservationSchema = z.object({
  id: Id, sourceUri: z.string().url().max(2048), observedAt: Time,
  relevant: z.boolean(), actionable: z.boolean(), objective: z.string().trim().max(4000),
  /** Stable source/capability keys come from deterministic adapters, never model similarity. */
  identityKeys: z.array(z.string().trim().min(1).max(2048)).min(1).max(20),
}).strict();
export type IntelligenceObservation = z.infer<typeof IntelligenceObservationSchema>;
export interface IntelligenceMatchTarget { id: string; identityKeys: string[] }
export interface IntelligenceIntakeDecision { decision: 'IGNORE' | 'WATCH' | 'ATTACH' | 'ACT'; targetIds: string[]; reason: string; modelCalls: 0 }

/** All matching precedes ACT. Ambiguous exact matches attach to each candidate for review. */
export function decideIntelligenceIntake(input: IntelligenceObservation, targets: readonly IntelligenceMatchTarget[]): IntelligenceIntakeDecision {
  const observation = IntelligenceObservationSchema.parse(input);
  if (!observation.relevant) return { decision: 'IGNORE', targetIds: [], reason: 'No relevant capability.', modelCalls: 0 };
  const matches = [...new Set(targets.filter(t => t.identityKeys.some(k => observation.identityKeys.includes(k))).map(t => t.id))].sort();
  if (matches.length) return { decision: 'ATTACH', targetIds: matches, reason: 'Exact existing source or capability identity.', modelCalls: 0 };
  if (!observation.actionable || !observation.objective) return { decision: 'WATCH', targetIds: [], reason: 'No executable objective.', modelCalls: 0 };
  return { decision: 'ACT', targetIds: [], reason: 'Relevant executable work has no exact existing identity.', modelCalls: 0 };
}
