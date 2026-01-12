import { AgentConfig } from './BaseAgent';
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
    SecurityAgent
];

// Re-export from types.ts for convenience
// The canonical VALID_AGENT_IDS is defined in types.ts to avoid circular dependencies
export { VALID_AGENT_IDS, VALID_AGENT_IDS_LIST, type ValidAgentId } from './types';
