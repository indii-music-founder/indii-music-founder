import type { HarnessCompiler, HarnessContext } from '@/services/business-harness/HarnessCompiler';
import type { HarnessRun } from '@/services/business-harness/types';
import type { ReleaseHarnessInput, ReleaseHarnessResult } from '@/services/release-harness/types';
import { releaseHarnessService } from '@/services/release-harness/ReleaseHarnessService';
import { releaseResultToHarnessRun } from '@/services/release-harness/ReleaseHarnessAdapter';

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
