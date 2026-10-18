import { CwrBatchInputSchema, type CwrBatchInput } from './cwr.js';

/** Receiver-specific preparation only; none of these profiles establishes delivery access. */
export const SOCIETY_ONBOARDING = Object.freeze({
  musicmark: {
    label: 'ASCAP / BMI / SOCAN through MusicMark', exportSupported: true,
    guide: 'https://www.musicmark.com/documents/MusicMark_getting_started.pdf',
    contact: 'https://www.musicmark.com/',
    steps: ['Confirm your publisher or administrator authority and actual sender identifiers.', 'Contact your ASCAP, BMI, or SOCAN CWR representative and complete the MusicMark test phase.', 'Obtain production approval and receiver-issued delivery credentials.', 'Keep the initial MusicMark acknowledgment separate from subsequent society acknowledgments.'],
  },
  the_mlc: {
    label: 'The MLC', exportSupported: true,
    guide: 'https://www.themlc.com/hubfs/CWR%20User%20Guide_May%202024_FINAL.pdf',
    contact: 'https://portal.themlc.com/contact-us',
    steps: ['Create the correct publisher or self-administered Member account and confirm administration authority.', 'Ask The MLC to become a CWR submitter and provide the requested test file.', 'Wait for test-file approval and receiver-issued production credentials.', 'Confirm the assigned transport and ACK pickup configuration with The MLC; public search API access does not register works.'],
  },
  sesac: {
    label: 'SESAC', exportSupported: false,
    guide: 'https://www.sesac.com/', contact: 'https://www.sesac.com/',
    steps: ['Confirm affiliation and authorized publisher or administrator status with SESAC.', 'Obtain the current recipient-specific registration requirements and onboarding instructions directly from SESAC.', 'Export is blocked until required receiver fields and validation have been implemented and accepted. MusicMark does not route to SESAC.'],
  },
});
export type SocietyRecipient = keyof typeof SOCIETY_ONBOARDING;
/** Decimal percentages become integer hundredths; no floating point share rounding. */
export function cwrPercentageUnits(text: string): number {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text.trim())) throw new Error('Enter an explicit percentage with at most two decimal places.');
  const [whole, fraction = ''] = text.trim().split('.');
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (units > 10000) throw new Error('A share cannot exceed 100%.');
  return units;
}
export function societyOnboardingChecklist(recipient: SocietyRecipient): string {
  const profile = SOCIETY_ONBOARDING[recipient];
  return [profile.label, 'Status: preparation only; no works transmitted or registered.', '', ...profile.steps.map((step, index) => `${index + 1}. ${step}`), '', `Official instructions: ${profile.guide}`, `Official contact: ${profile.contact}`, '', 'Prepare actual sender identity, authority documentation, catalog composition identifiers, writer/publisher relationships, ownership and collection shares, territories, and test-file/ACK evidence.', 'Never include passwords or private keys in this checklist.'].join('\n');
}

/** A saved preparation copy must retain canonical composition identities. No title/ISRC matching. */
export function societyPreparationCopy(raw: unknown): CwrBatchInput {
  const input = CwrBatchInputSchema.parse(raw);
  if (!input.catalogLinks || input.catalogLinks.length !== input.works.length
    || new Set(input.catalogLinks.map(link => link.entityId)).size !== input.works.length
    || new Set(input.catalogLinks.map(link => link.workId)).size !== input.works.length
    || input.works.some(work => !input.catalogLinks!.some(link => link.workId === work.workId))) throw new Error('Saved preparation has no complete canonical composition linkage. Start a new preparation rather than guessing identities.');
  return input;
}
export function cwrUnitsPercentage(units: number): string {
  if (!Number.isInteger(units) || units < 0 || units > 10000) throw new Error('Invalid CWR share units.');
  return `${Math.floor(units / 100)}.${String(units % 100).padStart(2, '0')}`;
}
