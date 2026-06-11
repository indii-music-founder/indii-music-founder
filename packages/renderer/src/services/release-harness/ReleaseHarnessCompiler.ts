import type { HarnessCompiler, HarnessContext } from '../business-harness/HarnessCompiler';
import type { HarnessRun } from '../business-harness/types';
import type { ReleaseHarnessInput, ReleaseHarnessResult } from './types';
import { releaseHarnessService } from './ReleaseHarnessService';
import { releaseResultToHarnessRun } from './ReleaseHarnessAdapter';

export class ReleaseHarnessCompiler implements HarnessCompiler<ReleaseHarnessInput, ReleaseHarnessResult> {
  readonly domain = 'release';

  async compile(input: ReleaseHarnessInput, ctx: HarnessContext): Promise<HarnessRun<ReleaseHarnessResult>> {
    const legacyInput = {
      ...input,
      userId: ctx.userId,
      projectId: ctx.projectId ?? input.projectId,
    };
    
    const legacyResult = await releaseHarnessService.compileReleaseHarness(legacyInput);
    return releaseResultToHarnessRun(legacyResult);
  }
}

export const releaseHarnessCompiler = new ReleaseHarnessCompiler();
