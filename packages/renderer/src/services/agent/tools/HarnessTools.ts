import { auth } from '@/services/firebase';
import {
  BUSINESS_HARNESS_CATALOG,
  getHarnessCatalogEntry,
  compileHarness,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HarnessRegistry,
  getHarnessRun,
  saveHarnessRun,
  listRecentHarnessRuns,
} from '@/services/business-harness';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { HarnessDomain, HarnessRun, HarnessInputRef, BoardroomHarnessDecision } from '@indii/shared';
import { boardroomMetaHarnessService } from '@/services/business-harness/BoardroomMetaHarnessService';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const HarnessTools: Record<string, AnyToolFunction> = {
  list_harness_catalog: wrapTool('list_harness_catalog', async () => {
    return toolSuccess(BUSINESS_HARNESS_CATALOG, 'Successfully retrieved the harness catalog.');
  }),

  compile_harness: wrapTool('compile_harness', async (args: {
    domain: HarnessDomain;
    projectId?: string;
    releaseId?: string;
    trackId?: string;
    sourceRunIds?: string[];
    inputRefs?: HarnessInputRef[];
    requestedAction?: string;
    payload?: Record<string, unknown>;
    save?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const entry = getHarnessCatalogEntry(args.domain);
    if (!entry) {
      return toolError(`Harness domain '${args.domain}' not found in the catalog.`, 'INVALID_DOMAIN');
    }

    try {
      const run = await compileHarness(
        args.domain,
        {
          projectId: args.projectId,
          releaseId: args.releaseId,
          trackId: args.trackId,
          sourceRunIds: args.sourceRunIds,
          inputRefs: args.inputRefs ?? [],
          requestedAction: args.requestedAction,
          payload: args.payload ?? {},
        },
        {
          userId,
          projectId: args.projectId,
          save: args.save,
        }
      );

      const savedRunId = args.save ? await saveHarnessRun(run) : undefined;

      return toolSuccess({
        run,
        savedRunId,
        ownerAgentId: entry.ownerAgentId,
        supportingAgentIds: entry.supportingAgentIds,
        approvalRequired: run.approvalGates.length > 0,
        blockedActions: run.approvalGates.filter(g => g.riskTier === 'blocked').map(g => g.requiredFor),
        boardroomRecommended: run.findings.some(f => f.severity === 'critical' || f.severity === 'high'),
      }, `Harness compilation complete for domain: ${args.domain}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return toolError(`Compilation failed: ${error.message}`, 'COMPILATION_ERROR');
    }
  }),

  get_harness_run: wrapTool('get_harness_run', async (args: {
    runId: string;
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const result = await getHarnessRun({
      userId,
      runId: args.runId,
      projectId: args.projectId,
    });
    if (!result) return toolError('Harness run not found', 'NOT_FOUND');
    return toolSuccess(result, 'Harness run loaded.');
  }),

  list_harness_runs: wrapTool('list_harness_runs', async (args: {
    projectId?: string;
    count?: number;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const runs = await listRecentHarnessRuns({
      userId,
      projectId: args.projectId,
      count: args.count,
    });
    return toolSuccess(runs, `Retrieved ${runs.length} recent harness runs.`);
  }),

  get_harness_context_for_agent: wrapTool('get_harness_context_for_agent', async (args: {
    agentId: string;
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const runs = await listRecentHarnessRuns({
      userId,
      projectId: args.projectId,
      count: 20,
    });

    const relevantRuns = runs.filter(run => {
      const entry = getHarnessCatalogEntry(run.domain);
      return entry?.ownerAgentId === args.agentId || entry?.supportingAgentIds.includes(args.agentId);
    });

    return toolSuccess(relevantRuns, `Retrieved ${relevantRuns.length} relevant harness runs for agent ${args.agentId}.`);
  }),

  create_boardroom_decision: wrapTool('create_boardroom_decision', async (args: {
    runIds: string[];
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    // Retrieve all runs
    const runs: HarnessRun[] = [];
    for (const runId of args.runIds) {
      const run = await getHarnessRun({ userId, runId, projectId: args.projectId });
      if (run) runs.push(run);
    }

    if (runs.length === 0) {
      return toolError('No valid harness runs found to evaluate.', 'NO_INPUTS');
    }

    try {
      const decision = await boardroomMetaHarnessService.createDecision({
        userId,
        projectId: args.projectId,
        runs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      return toolSuccess(decision, 'Boardroom decision generated.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return toolError(`Boardroom evaluation failed: ${error.message}`, 'BOARDROOM_ERROR');
    }
  }),

  explain_approval_gates: wrapTool('explain_approval_gates', async (args: {
    runId: string;
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const run = await getHarnessRun({ userId, runId: args.runId, projectId: args.projectId });
    if (!run) return toolError('Harness run not found', 'NOT_FOUND');

    return toolSuccess({
      domain: run.domain,
      approvalGates: run.approvalGates,
      assumptions: run.assumptions,
    }, 'Approval gates loaded.');
  }),

  create_harness_agent_brief: wrapTool('create_harness_agent_brief', async (args: {
    runId: string;
    agentId: string;
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const run = await getHarnessRun({ userId, runId: args.runId, projectId: args.projectId });
    if (!run) return toolError('Harness run not found', 'NOT_FOUND');

    const brief = run.agentBriefs.find(b => b.agentId === args.agentId);
    if (!brief) {
      return toolError(`No brief found for agent ${args.agentId} in harness run ${args.runId}`, 'BRIEF_NOT_FOUND');
    }

    return toolSuccess({
      runId: run.runId,
      domain: run.domain,
      brief,
      assumptions: run.assumptions,
    }, 'Agent brief successfully loaded.');
  }),
};
