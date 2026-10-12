export const NOW_WHAT_CAMPAIGNS = [
  { id: 'first-song', hook: 'You finished your first song. Now what?', answer: 'Document credits and ownership, then prepare your release.' },
  { id: 'already-released', hook: 'You released through DistroKid. Now what?', answer: 'Review collection coverage, organize your catalog, and plan promotion.' },
  { id: 'local-band', hook: 'You’re a popular local band. Now what?', answer: 'Prepare your EPK, booking terms, merchandise budget, and show finances.' },
  { id: 'growing-audience', hook: 'People are listening. Now what?', answer: 'Build direct fan relationships and a repeatable campaign.' },
  { id: 'earning-income', hook: 'Your music is making money. Now what?', answer: 'Organize income, expenses, and collaborator splits.' },
  { id: 'returning-artist', hook: 'You’re returning to music. Now what?', answer: 'Review your catalog and build a manageable restart plan.' },
] as const;

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
