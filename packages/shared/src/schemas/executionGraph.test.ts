import { describe, expect, it } from 'vitest';
import {
  ExecutionNodeSchema, decideIntelligenceIntake, validateExecutionGraph, verifyExecutionNode,
  type ExecutionEvidence, type ExecutionNode,
} from './executionGraph.js';

const node = (id: string, overrides: Partial<ExecutionNode> = {}): ExecutionNode => ExecutionNodeSchema.parse({
  schemaVersion: 'execution-node.v1', id, type: 'job', objective: 'Verify a repository capability.',
  source: { system: 'internal', key: id }, provenance: [], parent: null, children: [], relationships: [],
  status: 'planned', priority: 'medium', executor: null, dependencies: [], blockers: [], evidence: [], acceptanceCriteria: [],
  attempts: 0, cost: { usdMicros: 0, tokens: 0, wallTimeMs: 0 }, createdAt: 1, updatedAt: 1, terminalOutcome: null, ...overrides,
});
const evidence = (id: string, kind: ExecutionEvidence['kind'], authority: ExecutionEvidence['authority'] = 'deterministic-check'): ExecutionEvidence => ({
  id, kind, authority, uri: 'https://github.com/indii-music-founder/indii-music-founder/actions/runs/1',
  observedAt: 2, artifactIdentity: 'sha-a', result: 'pass',
});
const candidate = (): ExecutionNode => node('repair', {
  evidence: [evidence('patch', 'implementation', 'repository'), evidence('regression', 'test'), evidence('ci', 'ci')],
  acceptanceCriteria: [{ id: 'code', description: 'Patch, regression and CI prove the same revision.', artifactIdentity: 'sha-a', requiredEvidence: ['implementation', 'test', 'ci'], evidenceIds: ['patch', 'regression', 'ci'] }],
});

describe('execution graph authoritative verification', () => {
  it('rejects empty completion and executor self-declarations', () => {
    expect(ExecutionNodeSchema.safeParse({ ...node('job'), status: 'completed', terminalOutcome: 'verified' }).success).toBe(false);
    const job = candidate();
    job.evidence = job.evidence.map(e => ({ ...e, authority: 'model' }));
    expect(verifyExecutionNode(job, {})).toEqual(['Missing authoritative evidence: code']);
  });
  it('requires CI evidence for the same artifact rather than an older green run', () => {
    const job = candidate();
    job.evidence[2].artifactIdentity = 'sha-old';
    expect(verifyExecutionNode(job, {})).toEqual(['Missing authoritative evidence: code']);
    expect(ExecutionNodeSchema.safeParse({ ...job, status: 'completed', terminalOutcome: 'verified' }).success).toBe(false);
  });
  it('does not treat duplicate/overlap lineage as dependency completion', () => {
    const job = candidate();
    job.dependencies = ['registry'];
    job.relationships = [{ type: 'duplicates', target: 'other', evidenceIds: [] }];
    expect(verifyExecutionNode(job, { registry: node('registry') })).toEqual(['Unverified dependency: registry']);
  });
  it('enforces relationship dependencies and missing nodes', () => {
    const job = candidate();
    job.relationships = [{ type: 'depends-on', target: 'runtime', evidenceIds: [] }];
    expect(verifyExecutionNode(job, {})).toEqual(['Unverified dependency: runtime']);
    expect(() => validateExecutionGraph({ repair: job })).toThrow('Missing graph node');
  });
  it('accepts verified completion while failing closed on dependency cycles', () => {
    const completed = ExecutionNodeSchema.parse({ ...candidate(), status: 'completed', terminalOutcome: 'verified' });
    expect(() => validateExecutionGraph({ repair: completed })).not.toThrow();
    expect(() => validateExecutionGraph({ a: node('a', { dependencies: ['b'] }), b: node('b', { dependencies: ['a'] }) })).toThrow('Cyclic dependency');
  });
  it('rejects unverified external acceptance even when all code checks pass', () => {
    const job = candidate();
    job.acceptanceCriteria[0].requiredEvidence.push('external');
    expect(verifyExecutionNode(job, {})).toEqual(['Missing authoritative evidence: code']);
  });
  it('rejects nonreciprocal parent lineage and duplicate identities', () => {
    expect(() => validateExecutionGraph({ parent: node('parent'), child: node('child', { parent: 'parent' }) })).toThrow('not reciprocal');
    expect(ExecutionNodeSchema.safeParse({ ...node('a'), dependencies: ['b', 'b'] }).success).toBe(false);
  });
  it('rejects reciprocal parent cycles', () => {
    expect(() => validateExecutionGraph({ a: node('a', { parent: 'b', children: ['b'] }), b: node('b', { parent: 'a', children: ['a'] }) })).toThrow('Cyclic dependency');
  });
  it('holds convergence open until every child has verified completion', () => {
    const parent = candidate();
    parent.children = ['runtime'];
    expect(verifyExecutionNode(parent, { runtime: node('runtime', { parent: parent.id }) })).toEqual(['Unverified dependency: runtime']);
  });
});

describe('deterministic intelligence intake', () => {
  const observation = { id: 'industry-change', sourceUri: 'https://example.org/policy', observedAt: 1, relevant: true, actionable: true, objective: 'Assess the policy change.', identityKeys: ['capability:provenance'] };
  it('uses all four gates without invoking a model', () => {
    expect(decideIntelligenceIntake({ ...observation, relevant: false }, []).decision).toBe('IGNORE');
    expect(decideIntelligenceIntake({ ...observation, actionable: false }, []).decision).toBe('WATCH');
    expect(decideIntelligenceIntake(observation, []).decision).toBe('ACT');
    expect(decideIntelligenceIntake(observation, [{ id: 'existing', identityKeys: observation.identityKeys }])).toEqual({ decision: 'ATTACH', targetIds: ['existing'], reason: 'Exact existing source or capability identity.', modelCalls: 0 });
  });
  it('matches before ACT even for nonactionable observations', () => {
    expect(decideIntelligenceIntake({ ...observation, actionable: false }, [{ id: 'existing', identityKeys: observation.identityKeys }]).decision).toBe('ATTACH');
  });
  it('keeps ambiguous exact matches attached without merging or declaring duplicates', () => {
    const result = decideIntelligenceIntake(observation, [{ id: 'b', identityKeys: observation.identityKeys }, { id: 'a', identityKeys: observation.identityKeys }]);
    expect(result.targetIds).toEqual(['a', 'b']);
    expect(result.decision).toBe('ATTACH');
  });
  it('does not ACT without an executable objective', () => {
    expect(decideIntelligenceIntake({ ...observation, objective: '  ' }, []).decision).toBe('WATCH');
  });
});
