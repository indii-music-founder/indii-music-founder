import { AgentConfig } from './BaseAgent';
import { MarketingAgent } from './definitions/MarketingAgent';
import { LegalAgent } from './definitions/LegalAgent';
import { FinanceAgent } from './definitions/FinanceAgent';
import { MusicAgent } from './definitions/MusicAgent';
import { DirectorAgent } from '@/agents/director/config';
import { VideoAgent } from './definitions/VideoAgent';
import { SocialAgent } from './definitions/SocialAgent';
import { PublicistAgent } from './definitions/PublicistAgent';
import { RoadAgent } from './definitions/RoadAgent';
import { PublishingAgent } from './definitions/PublishingAgent';
import { LicensingAgent } from './definitions/LicensingAgent';
import { BrandAgent } from './definitions/BrandAgent';
import { DevOpsAgent } from './definitions/DevOpsAgent';
import { SecurityAgent } from './definitions/SecurityAgent';

export const AGENT_REGISTRY: AgentConfig[] = [
    MarketingAgent,
    LegalAgent,
    FinanceAgent,
    MusicAgent,
    DirectorAgent,
    VideoAgent,
    SocialAgent,
    PublicistAgent,
    RoadAgent,
    PublishingAgent,
    LicensingAgent,
    BrandAgent,
    BrandAgent,
    // DevOpsAgent, // Internal / Testing only
    // SecurityAgent // Internal / Testing only
];
