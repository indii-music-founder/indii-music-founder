import { AgentCard } from './AgentCard.schema';
import { BrandCard } from './cards/brand.card';
import { CreativeCard } from './cards/creative.card';
import { CurriculumCard } from './cards/curriculum.card';
import { DevopsCard } from './cards/devops.card';
import { DirectorCard } from './cards/director.card';
import { DistributionCard } from './cards/distribution.card';
import { FinanceAccountingCard } from './cards/finance.accounting.card';
import { FinanceCard } from './cards/finance.card';
import { FinanceRoyaltyCard } from './cards/finance.royalty.card';
import { FinanceTaxCard } from './cards/finance.tax.card';
import { KeeperCard } from './cards/keeper.card';
import { LegalCard } from './cards/legal.card';
import { LegalComplianceCard } from './cards/legal.compliance.card';
import { LegalContractsCard } from './cards/legal.contracts.card';
import { LicensingCard } from './cards/licensing.card';
import { MarketingCard } from './cards/marketing.card';
import { MerchandiseCard } from './cards/merchandise.card';
import { MusicCard } from './cards/music.card';
import { ProducerCard } from './cards/producer.card';
import { PublicistCard } from './cards/publicist.card';
import { PublishingCard } from './cards/publishing.card';
import { RoadCard } from './cards/road.card';
import { ScreenwriterCard } from './cards/screenwriter.card';
import { SecurityCard } from './cards/security.card';
import { SocialCard } from './cards/social.card';
import { VideoCard } from './cards/video.card';

export const CARD_REGISTRY: Record<string, AgentCard> = {
    'brand': BrandCard,
    'creative': CreativeCard,
    'curriculum': CurriculumCard,
    'devops': DevopsCard,
    'director': DirectorCard,
    'distribution': DistributionCard,
    'finance.accounting': FinanceAccountingCard,
    'finance': FinanceCard,
    'finance.royalty': FinanceRoyaltyCard,
    'finance.tax': FinanceTaxCard,
    'keeper': KeeperCard,
    'legal': LegalCard,
    'legal.compliance': LegalComplianceCard,
    'legal.contracts': LegalContractsCard,
    'licensing': LicensingCard,
    'marketing': MarketingCard,
    'merchandise': MerchandiseCard,
    'music': MusicCard,
    'producer': ProducerCard,
    'publicist': PublicistCard,
    'publishing': PublishingCard,
    'road': RoadCard,
    'screenwriter': ScreenwriterCard,
    'security': SecurityCard,
    'social': SocialCard,
    'video': VideoCard
};

export function getCardForAgent(agentId: string): AgentCard | undefined {
    return CARD_REGISTRY[agentId];
}
