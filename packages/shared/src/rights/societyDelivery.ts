import { z } from 'zod';
export const SocietyRecipientSchema = z.enum(['musicmark', 'the_mlc', 'sesac']);
const Receipt = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/);
const Directory = z.string().max(300).regex(/^\/[A-Za-z0-9_./-]*$/).refine(value => !value.split('/').some(part => part === '.' || part === '..'), 'Remote directories cannot traverse paths.');
export const SocietyDeliveryProfileSchema = z.object({
  approved: z.literal(true), revision: z.number().int().positive(),
  authorityReceiptId: Receipt, onboardingReceiptId: Receipt,
  senderName: z.string().trim().min(1).max(45).regex(/^[\x20-\x7e]+$/), senderCode: z.string().regex(/^[A-Z0-9]{2,3}$/),
  senderIpi: z.string().regex(/^\d{9,11}$/), recipient: SocietyRecipientSchema,
  versions: z.array(z.enum(['2.1', '2.2'])).min(1).max(2), protocol: z.literal('sftp'),
  host: z.string().max(253).regex(/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/),
  port: z.number().int().min(1).max(65535), hostKeySha256: z.string().regex(/^[a-f0-9]{64}$/),
  directory: Directory, ackDirectory: Directory,
  username: z.string().min(1).max(200), secretVersion: z.string().regex(/^projects\/[A-Za-z0-9_-]+\/secrets\/[A-Za-z0-9_-]+\/versions\/[0-9]+$/),
}).strict();
export type SocietyDeliveryProfile = z.infer<typeof SocietyDeliveryProfileSchema>;
export function publicSocietyDeliveryStatus(raw: unknown, enabled: boolean) {
  const result = SocietyDeliveryProfileSchema.safeParse(raw);
  if (!result.success) return { configured: false, enabled: false, reason: 'Receiver-approved secure transport is not configured.' };
  const p = result.data;
  return { configured: true, enabled, revision: p.revision, recipient: p.recipient, senderIpi: p.senderIpi, versions: p.versions,
    protocol: p.protocol, reason: enabled ? 'Receiver-approved transport available. Approve the exact batch before sending.' : 'Production delivery switch is off.' };
}
/** Deny private, reserved, documentation, multicast and link-local addresses. */
export function isPublicSocietyIpv4(address: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return false;
  const [a, b, c, d] = address.split('.').map(Number);
  if ([a, b, c, d].some(n => n > 255)) return false;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
    || a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127
    || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
}
export function societySecretNamespace(uid: string, recipient: string): string {
  // UTF-8 owner identity is hashed by the server before calling this helper.
  if (!/^[a-f0-9]{32}$/.test(uid) || !SocietyRecipientSchema.safeParse(recipient).success) throw new Error('Invalid secret namespace.');
  return `rights-cwr-${uid}-${recipient}`;
}
export function validateSocietySecretReference(profile: SocietyDeliveryProfile, project: string, ownerHash: string): void {
  const expected = `projects/${project}/secrets/${societySecretNamespace(ownerHash, profile.recipient)}/versions/`;
  if (!project || !profile.secretVersion.startsWith(expected)) throw new Error('Credential must belong to this project, owner, and recipient namespace.');
}
