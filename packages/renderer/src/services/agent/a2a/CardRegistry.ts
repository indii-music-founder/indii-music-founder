import { AgentCard } from './AgentCard.schema';
import brandCard from '@agents/brand/agent_card.json';
import creativeCard from '@agents/creative/agent_card.json';
import curriculumCard from '@agents/indii_curriculum/agent_card.json';
import { DevopsCard } from './cards/devops.card';
import { DirectorCard } from './cards/director.card';
import distributionCard from '@agents/distribution/agent_card.json';
import { FinanceAccountingCard } from './cards/finance.accounting.card';
import financeCard from '@agents/finance/agent_card.json';
import { FinanceRoyaltyCard } from './cards/finance.royalty.card';
import { FinanceTaxCard } from './cards/finance.tax.card';
import { KeeperCard } from './cards/keeper.card';
import legalCard from '@agents/legal/agent_card.json';
import { LegalComplianceCard } from './cards/legal.compliance.card';
import { LegalContractsCard } from './cards/legal.contracts.card';
import licensingCard from '@agents/licensing/agent_card.json';
import marketingCard from '@agents/marketing/agent_card.json';
import merchandiseCard from '@agents/merchandise/agent_card.json';
import musicCard from '@agents/music/agent_card.json';
import { ProducerCard } from './cards/producer.card';
import publicistCard from '@agents/publicist/agent_card.json';
import publishingCard from '@agents/publishing/agent_card.json';
import roadCard from '@agents/road/agent_card.json';
import { ScreenwriterCard } from './cards/screenwriter.card';
import { SecurityCard } from './cards/security.card';
import socialCard from '@agents/social/agent_card.json';
import videoCard from '@agents/video/agent_card.json';
import analyticsCard from '@agents/analytics/agent_card.json';
import generalistCard from '@agents/conductor/agent_card.json';
import defaultCard from '@agents/default/agent_card.json';

export const CARD_REGISTRY: Record<string, AgentCard> = {
    'brand': brandCard as AgentCard,
    'creative': creativeCard as AgentCard,
    'curriculum': curriculumCard as AgentCard,
    'devops': DevopsCard,
    'director': DirectorCard,
    'distribution': distributionCard as AgentCard,
    'finance.accounting': FinanceAccountingCard,
    'finance': financeCard as AgentCard,
    'finance.royalty': FinanceRoyaltyCard,
    'finance.tax': FinanceTaxCard,
    'keeper': KeeperCard,
    'legal': legalCard as AgentCard,
    'legal.compliance': LegalComplianceCard,
    'legal.contracts': LegalContractsCard,
    'licensing': licensingCard as AgentCard,
    'marketing': marketingCard as AgentCard,
    'merchandise': merchandiseCard as AgentCard,
    'music': musicCard as AgentCard,
    'producer': ProducerCard,
    'publicist': publicistCard as AgentCard,
    'publishing': publishingCard as AgentCard,
    'road': roadCard as AgentCard,
    'screenwriter': ScreenwriterCard,
    'security': SecurityCard,
    'social': socialCard as AgentCard,
    'video': videoCard as AgentCard,
    'analytics': analyticsCard as AgentCard,
    'generalist': generalistCard as AgentCard,
    'default': defaultCard as AgentCard
};

export function getCardForAgent(agentId: string): AgentCard | undefined {
    return CARD_REGISTRY[agentId];
}
