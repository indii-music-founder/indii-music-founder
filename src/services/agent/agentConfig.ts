import { AgentConfig } from './types';
import { MarketingAgent } from './definitions/MarketingAgent';
import { LegalAgent } from '@/agents/legal/config';
import { FinanceAgent } from './definitions/FinanceAgent';
import { DirectorAgent } from '@/agents/director/config';
import { VideoAgent } from './definitions/VideoAgent';
import { SocialAgent } from './definitions/SocialAgent';
import { PublicistAgent } from './definitions/PublicistAgent';
import { RoadAgent } from './definitions/RoadAgent';
import { PublishingAgent } from './definitions/PublishingAgent';
import { LicensingAgent } from './definitions/LicensingAgent';
import { BrandAgent } from './definitions/BrandAgent';
import { ScreenwriterAgent } from '@/agents/screenwriter/config';
import { ProducerAgent } from '@/agents/producer/config';
import { SecurityAgent } from './definitions/SecurityAgent';
import { DevOpsAgent } from './definitions/DevOpsAgent';
import { DistributionAgent } from './definitions/DistributionAgent';
import { MusicAgent } from './definitions/MusicAgent';

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
    PublishingAgent,
    LicensingAgent,
    BrandAgent,
    DevOpsAgent,
    SecurityAgent,
    DistributionAgent,
    MusicAgent
];

import { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST } from './types';
export { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST } from './types';
export type { ValidAgentId } from './types';

import { freezeAgentConfig } from './FreezeDiagnostic';
import { logger } from '@/utils/logger';

// Safety net: freeze all agent configurations to prevent shared state contamination
AGENT_CONFIGS.forEach(agent => {
    try {
        freezeAgentConfig(agent);
    } catch (e) {
        logger.warn(`[agentConfig] Failed to freeze agent "${agent.id}":`, e);
    }
});

