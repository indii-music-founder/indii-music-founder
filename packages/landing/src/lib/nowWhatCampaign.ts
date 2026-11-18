import { NOW_WHAT_HOOKS } from '@shared/share/nowWhat';

export const NOW_WHAT_CAMPAIGNS = NOW_WHAT_HOOKS;

export const CAMPAIGN_KEYS = ['entry', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type CampaignAttribution = Partial<Record<typeof CAMPAIGN_KEYS[number], string>>;

/** Campaign context never supplies or changes assessment answers. */
export function readCampaignAttribution(search: string): CampaignAttribution {
  const params = new URLSearchParams(search);
  const result: CampaignAttribution = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key)?.trim().slice(0, 128);
    if (!value) continue;
    if (key === 'entry' && !NOW_WHAT_CAMPAIGNS.some(c => c.id === value)) continue;
    result[key] = value;
  }
  return result;
}

export function campaignQuery(search: string): string {
  const incoming = new URLSearchParams(search);
  const params = new URLSearchParams(readCampaignAttribution(search));
  for (const key of ['source', 'assessmentId']) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  return params.size ? `?${params.toString()}` : '';
}
