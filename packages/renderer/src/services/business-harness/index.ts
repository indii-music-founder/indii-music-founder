import { HarnessRegistry } from './HarnessCompiler';
import { songDnaCompiler } from './SongDnaCompiler';
import { distributionDdexCompiler } from './DistributionDdexCompiler';
import { merchPodHarnessService } from './MerchPodHarnessService';
import { creatorProtectionCompiler } from '../creator-protection/CreatorProtectionCompiler';
import { releaseHarnessCompiler } from '../release-harness/ReleaseHarnessCompiler';

HarnessRegistry.register(songDnaCompiler);
HarnessRegistry.register(distributionDdexCompiler);
HarnessRegistry.register(merchPodHarnessService);
HarnessRegistry.register(creatorProtectionCompiler);
HarnessRegistry.register(releaseHarnessCompiler);

export * from './types';
export * from './HarnessCompiler';
export * from './SongDnaCompiler';
export * from './DistributionDdexCompiler';
export * from './ApprovalGateRegistry';
export * from './HarnessStorage';
export * from './ActivityValueService';
export * from './HiddenCostHarnessService';
export * from './BoardroomMetaHarnessService';
export * from './BusinessActivityTracker';
export * from './HarnessCatalog';
export * from './MerchPodHarnessService';
export * from './UploadIntakeHarnessService';
