import type { BoardroomHarnessDecision, HarnessRun, HarnessSeverity } from './types';
import { hiddenCostHarnessService } from './HiddenCostHarnessService';

const SEVERITY_ORDER: HarnessSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];

export class BoardroomMetaHarnessService {
  createDecision(input: {
    userId: string;
    runs: HarnessRun[];
    requestedAction: string;
  }): BoardroomHarnessDecision {
    const blockers = input.runs.flatMap(run => [
      ...run.approvalGates
        .filter(gate => gate.riskTier === 'blocked' || gate.riskTier === 'attorney_review' || gate.riskTier === 'destructive')
        .map(gate => `${run.domain}: ${gate.label}`),
      ...run.findings
        .filter(finding => finding.severity === 'critical')
        .map(finding => `${run.domain}: ${finding.title}`),
    ]);

    const approvalNeeded = input.runs.some(run =>
      run.approvalGates.length > 0 ||
      run.recommendations.some(rec => rec.approvalRequired)
    );
    const legalRisk = input.runs
      .flatMap(run => run.findings)
      .filter(finding => finding.domain === 'legal_compliance' || finding.domain === 'creator_protection')
      .reduce<HarnessSeverity>((max, finding) => (
        SEVERITY_ORDER.indexOf(finding.severity) > SEVERITY_ORDER.indexOf(max) ? finding.severity : max
      ), 'info');

    const mode: BoardroomHarnessDecision['mode'] = blockers.length
      ? 'blocked'
      : approvalNeeded
        ? 'approval'
        : input.runs.length
          ? 'execution_ready'
          : 'advisory';
    const decision: BoardroomHarnessDecision['decision'] = blockers.length
      ? 'block'
      : legalRisk === 'high' || legalRisk === 'critical'
        ? 'escalate'
        : approvalNeeded
          ? 'defer'
          : 'approve';

    const departments = new Set(input.runs.flatMap(run => run.agentBriefs.map(brief => brief.departmentId ?? brief.agentId)));
    const costImpact = hiddenCostHarnessService.summarizeCostLines(input.runs.flatMap(run => run.costLines));

    return {
      decisionId: `boardroom_decision_${Date.now()}`,
      mode,
      decision,
      rationale: buildRationale(input.runs, blockers, legalRisk, approvalNeeded),
      sourceRunIds: input.runs.map(run => run.runId),
      departmentsConsulted: [...departments],
      blockers,
      costImpact,
      legalRisk,
      nextAction: buildNextAction(input.requestedAction, blockers, approvalNeeded, legalRisk),
      userApprovalRequired: approvalNeeded || blockers.length > 0 || legalRisk === 'high' || legalRisk === 'critical',
      createdAt: new Date().toISOString(),
    };
  }
}

export const boardroomMetaHarnessService = new BoardroomMetaHarnessService();

function buildRationale(runs: HarnessRun[], blockers: string[], legalRisk: HarnessSeverity, approvalNeeded: boolean): string[] {
  if (!runs.length) {
    return ['No domain harness runs are attached yet, so Boardroom can only provide advisory routing.'];
  }
  return [
    `${runs.length} harness run${runs.length === 1 ? '' : 's'} reviewed across ${new Set(runs.map(run => run.domain)).size} domain${runs.length === 1 ? '' : 's'}.`,
    blockers.length ? `${blockers.length} blocker${blockers.length === 1 ? '' : 's'} prevent execution.` : 'No hard blockers detected.',
    `Legal risk is ${legalRisk}.`,
    approvalNeeded ? 'At least one recommendation or approval gate requires user approval.' : 'No explicit approval gate was found.',
  ];
}

function buildNextAction(requestedAction: string, blockers: string[], approvalNeeded: boolean, legalRisk: HarnessSeverity): string {
  if (blockers.length) return `Resolve blocker before ${requestedAction}: ${blockers[0]}`;
  if (legalRisk === 'high' || legalRisk === 'critical') return `Route ${requestedAction} through Legal before execution.`;
  if (approvalNeeded) return `Ask the user to approve ${requestedAction} before external execution.`;
  return `Prepare ${requestedAction} for execution; do not spend, publish, deliver, or file externally without the relevant domain gate.`;
}

