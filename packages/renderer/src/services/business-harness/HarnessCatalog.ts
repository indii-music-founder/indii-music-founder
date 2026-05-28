import type { HarnessDomain } from './types';

export interface HarnessCatalogEntry {
  domain: HarnessDomain;
  name: string;
  ownerAgentId: string;
  supportingAgentIds: string[];
  purpose: string;
  irreversibleActionsRequireApproval: boolean;
}

export const BUSINESS_HARNESS_CATALOG: HarnessCatalogEntry[] = [
  { domain: 'artist_memory', name: 'Artist Memory / Operating Model', ownerAgentId: 'keeper', supportingAgentIds: ['creative', 'finance', 'legal'], purpose: 'Personalize every harness around how the artist works, decides, spends, and releases.', irreversibleActionsRequireApproval: false },
  { domain: 'song_dna', name: 'Song DNA / Creative Intake', ownerAgentId: 'music', supportingAgentIds: ['marketing', 'legal', 'distribution'], purpose: 'Extract musical, market, rights, and campaign signals from uploaded work.', irreversibleActionsRequireApproval: false },
  { domain: 'creator_protection', name: 'AI Digital Replica & Creator Protection', ownerAgentId: 'legal', supportingAgentIds: ['security', 'distribution', 'publishing'], purpose: 'Protect voice, likeness, artist name, brand, works, and identity from AI misuse.', irreversibleActionsRequireApproval: true },
  { domain: 'distribution_ddex', name: 'Distribution / DDEX', ownerAgentId: 'distribution', supportingAgentIds: ['legal', 'publishing'], purpose: 'Compile direct-to-storefront delivery readiness, metadata, territories, and identifiers.', irreversibleActionsRequireApproval: true },
  { domain: 'release', name: 'Release Harness', ownerAgentId: 'distribution', supportingAgentIds: ['marketing', 'creative', 'finance', 'legal'], purpose: 'Compile song DNA, memory, DDEX, identifiers, budget, and timing into release strategy.', irreversibleActionsRequireApproval: true },
  { domain: 'finance', name: 'Finance Harness', ownerAgentId: 'finance', supportingAgentIds: ['finance.accounting', 'finance.tax', 'finance.royalty'], purpose: 'Aggregate revenue, expenses, hidden costs, tax classifications, and ROI.', irreversibleActionsRequireApproval: false },
  { domain: 'activity_time_value', name: 'Activity / Time Value', ownerAgentId: 'finance', supportingAgentIds: ['keeper'], purpose: 'Track focused app and business labor time as investment value, not revenue.', irreversibleActionsRequireApproval: false },
  { domain: 'road_travel', name: 'Road / Travel', ownerAgentId: 'road', supportingAgentIds: ['finance', 'legal'], purpose: 'Compile route, mileage, lodging, per diem, logistics, and tour cost lines.', irreversibleActionsRequireApproval: true },
  { domain: 'gear_asset', name: 'Gear / Asset', ownerAgentId: 'finance', supportingAgentIds: ['music', 'road'], purpose: 'Track equipment, consumables, repairs, depreciation, warranties, and project use.', irreversibleActionsRequireApproval: false },
  { domain: 'merch_pod', name: 'Merch / Print-on-Demand', ownerAgentId: 'merchandise', supportingAgentIds: ['finance', 'legal', 'brand'], purpose: 'Compile POD products, SKU margins, provider choices, samples, and drop readiness.', irreversibleActionsRequireApproval: true },
  { domain: 'marketing_growth', name: 'Marketing / Growth', ownerAgentId: 'marketing', supportingAgentIds: ['social', 'publicist', 'brand'], purpose: 'Compile channel mix, content calendar, test matrix, and campaign optimization.', irreversibleActionsRequireApproval: true },
  { domain: 'fan_crm', name: 'Fan / CRM', ownerAgentId: 'marketing', supportingAgentIds: ['social', 'merchandise', 'road'], purpose: 'Segment fans, superfans, geography, purchases, engagement, and live demand.', irreversibleActionsRequireApproval: false },
  { domain: 'publishing_rights', name: 'Publishing / Rights', ownerAgentId: 'publishing', supportingAgentIds: ['legal', 'finance.royalty'], purpose: 'Compile composition, splits, PRO, MLC, ISWC, IPI/CAE, and publisher readiness.', irreversibleActionsRequireApproval: true },
  { domain: 'collaboration_splits', name: 'Collaboration / Splits', ownerAgentId: 'legal', supportingAgentIds: ['publishing', 'finance'], purpose: 'Compile collaborator roles, approvals, splits, disputes, and missing agreements.', irreversibleActionsRequireApproval: true },
  { domain: 'licensing_sync', name: 'Licensing / Sync', ownerAgentId: 'licensing', supportingAgentIds: ['legal', 'publishing'], purpose: 'Compile sync readiness, stems, rights, pitch package, and opportunity fit.', irreversibleActionsRequireApproval: true },
  { domain: 'royalty_revenue', name: 'Royalty / Revenue', ownerAgentId: 'finance.royalty', supportingAgentIds: ['publishing', 'distribution'], purpose: 'Track statements, waterfalls, recoupment, unpaid balances, and revenue sources.', irreversibleActionsRequireApproval: false },
  { domain: 'legal_compliance', name: 'Legal / Compliance', ownerAgentId: 'legal', supportingAgentIds: ['legal.contracts', 'legal.compliance', 'security'], purpose: 'Compile contracts, samples, trademarks, AI clauses, privacy, compliance, and approvals.', irreversibleActionsRequireApproval: true },
  { domain: 'creative_production', name: 'Creative Production', ownerAgentId: 'creative', supportingAgentIds: ['producer', 'director', 'video'], purpose: 'Compile demos, mixes, masters, stems, artwork, credits, and delivery assets.', irreversibleActionsRequireApproval: false },
  { domain: 'opportunity', name: 'Opportunity', ownerAgentId: 'generalist', supportingAgentIds: ['finance', 'legal', 'marketing'], purpose: 'Score shows, playlists, collabs, sponsorships, sync leads, grants, press, and brand deals.', irreversibleActionsRequireApproval: true },
  { domain: 'education_curriculum', name: 'Education / Curriculum', ownerAgentId: 'curriculum', supportingAgentIds: ['keeper'], purpose: 'Compile learning gaps and just-in-time education from user behavior.', irreversibleActionsRequireApproval: false },
  { domain: 'security_trust', name: 'Security / Trust', ownerAgentId: 'security', supportingAgentIds: ['legal', 'devops'], purpose: 'Compile permissions, credentials, spending, legal evidence, biometric consent, and audit trails.', irreversibleActionsRequireApproval: true },
  { domain: 'boardroom_meta', name: 'Boardroom Meta-Harness', ownerAgentId: 'generalist', supportingAgentIds: ['finance', 'legal', 'distribution', 'marketing', 'road', 'merchandise'], purpose: 'Read domain harness runs and decide approve, defer, reroute, escalate, or block.', irreversibleActionsRequireApproval: true },
];

export function getHarnessCatalogEntry(domain: HarnessDomain): HarnessCatalogEntry | undefined {
  return BUSINESS_HARNESS_CATALOG.find(entry => entry.domain === domain);
}

