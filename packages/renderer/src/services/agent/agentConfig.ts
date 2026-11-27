import { AgentConfig } from '@/services/agent/types';
import { MarketingAgent } from '@/services/agent/definitions/MarketingAgent';
import { LegalAgent } from '@/agents/legal/config';
import { FinanceAgent } from '@/services/agent/definitions/FinanceAgent';
import { DirectorAgent } from '@/agents/director/config';
import { VideoAgent } from '@/services/agent/definitions/VideoAgent';
import { SocialAgent } from '@/services/agent/definitions/SocialAgent';
import { PublicistAgent } from '@/services/agent/definitions/PublicistAgent';
import { RoadAgent } from '@/services/agent/definitions/RoadAgent';
import { HospitalityAgent } from '@/services/agent/definitions/HospitalityAgent';
import { EventPlannerAgent } from '@/services/agent/definitions/EventPlannerAgent';
import { PublishingAgent } from '@/services/agent/definitions/PublishingAgent';
import { LicensingAgent } from '@/services/agent/definitions/LicensingAgent';
import { BrandAgent } from '@/services/agent/definitions/BrandAgent';
import { ScreenwriterAgent } from '@/agents/screenwriter/config';
import { ProducerAgent } from '@/agents/producer/config';
import { SecurityAgent } from '@/services/agent/definitions/SecurityAgent';
import { DevOpsAgent } from '@/services/agent/definitions/DevOpsAgent';
import { DistributionAgent } from '@/services/agent/definitions/DistributionAgent';
import { MusicAgent } from '@/services/agent/definitions/MusicAgent';
import { CreativeAgent } from '@/services/agent/definitions/CreativeAgent';
import { AnalyticsAgent } from '@/services/agent/definitions/AnalyticsAgent';

// Phase 3: Finance Workers
import { FinanceTaxAgent } from '@/agents/finance/workers/tax.config';
import { FinanceRoyaltyAgent } from '@/agents/finance/workers/royalty.config';
import { FinanceAccountingAgent } from '@/agents/finance/workers/accounting.config';
import { RightsAgent } from '@/agents/rights/config';

export const AGENT_CONFIGS: AgentConfig[] = [
    MarketingAgent,
    LegalAgent,
    FinanceAgent,
    ProducerAgent,
    DirectorAgent,
    ScreenwriterAgent,
    VideoAgent,
    SocialAgent,
    PublicistAgent,
    RoadAgent,
    HospitalityAgent,
    EventPlannerAgent,
    PublishingAgent,
    LicensingAgent,
    BrandAgent,
    DevOpsAgent,
    SecurityAgent,
    DistributionAgent,
    MusicAgent,
    CreativeAgent,
    AnalyticsAgent,
    FinanceTaxAgent,
    FinanceRoyaltyAgent,
    FinanceAccountingAgent,
    RightsAgent
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST } from '@/services/agent/types';
export { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST } from '@/services/agent/types';
export type { ValidAgentId } from '@/services/agent/types';

import { freezeAgentConfig } from '@/services/agent/FreezeDiagnostic';
import { logger } from '@/utils/logger';

// Safety net: freeze all agent configurations to prevent shared state contamination
AGENT_CONFIGS.forEach(agent => {
    try {
        freezeAgentConfig(agent);
    } catch (e: unknown) {
        logger.warn(`[agentConfig] Failed to freeze agent "${agent.id}":`, e);
    }
});

