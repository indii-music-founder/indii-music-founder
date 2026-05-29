import { HarnessRegistry } from './HarnessCompiler';
import { songDnaCompiler } from './SongDnaCompiler';
import { distributionDdexCompiler } from './DistributionDdexCompiler';
import { merchPodHarnessService } from './MerchPodHarnessService';
import { creatorProtectionCompiler } from '../creator-protection/CreatorProtectionCompiler';
import { releaseHarnessCompiler } from '../release-harness/ReleaseHarnessCompiler';

import { PublishingRightsCompiler } from '../publishing/PublishingRightsCompiler';
import { CollaborationSplitsCompiler } from '../collaboration/CollaborationSplitsCompiler';
import { CreativeProductionCompiler } from '../creative/CreativeProductionCompiler';
import { LegalComplianceCompiler } from '../legal/LegalComplianceCompiler';
import { SecurityTrustCompiler } from '../security/SecurityTrustCompiler';

import { FinanceCompiler } from '../finance/FinanceCompiler';
import { ActivityTimeValueCompiler } from './ActivityTimeValueCompiler';
import { RoadTravelCompiler } from '../touring/RoadTravelCompiler';
import { GearAssetCompiler } from '../finance/GearAssetCompiler';
import { RoyaltyRevenueCompiler } from '../finance/RoyaltyRevenueCompiler';

import { MarketingGrowthCompiler } from '../marketing/MarketingGrowthCompiler';
import { FanCrmCompiler } from '../marketing/crm/FanCrmCompiler';
import { LicensingSyncCompiler } from '../licensing/LicensingSyncCompiler';
import { OpportunityCompiler } from './OpportunityCompiler';
import { EducationCurriculumCompiler } from '../education/EducationCurriculumCompiler';HarnessRegistry.register(songDnaCompiler);
HarnessRegistry.register(distributionDdexCompiler);
HarnessRegistry.register(merchPodHarnessService);
HarnessRegistry.register(creatorProtectionCompiler);
HarnessRegistry.register(releaseHarnessCompiler);

HarnessRegistry.register(new PublishingRightsCompiler());
HarnessRegistry.register(new CollaborationSplitsCompiler());
HarnessRegistry.register(new CreativeProductionCompiler());
HarnessRegistry.register(new LegalComplianceCompiler());
HarnessRegistry.register(new SecurityTrustCompiler());

HarnessRegistry.register(new FinanceCompiler());
HarnessRegistry.register(new ActivityTimeValueCompiler());
HarnessRegistry.register(new RoadTravelCompiler());
HarnessRegistry.register(new GearAssetCompiler());
HarnessRegistry.register(new RoyaltyRevenueCompiler());

HarnessRegistry.register(new MarketingGrowthCompiler());
HarnessRegistry.register(new FanCrmCompiler());
HarnessRegistry.register(new LicensingSyncCompiler());
HarnessRegistry.register(new OpportunityCompiler());
HarnessRegistry.register(new EducationCurriculumCompiler());

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
