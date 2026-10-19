import { describe, expect, it } from 'vitest';
import { isPublicSocietyIpv4, publicSocietyDeliveryStatus, SocietyDeliveryProfileSchema, validateSocietySecretReference } from './societyDelivery';
const profile = { approved: true as const, revision: 1, authorityReceiptId: 'authority:1', onboardingReceiptId: 'receiver:1', senderName: 'PUBLISHER', senderCode: 'PUB', senderIpi: '00123456789', recipient: 'the_mlc' as const, versions: ['2.2' as const], protocol: 'sftp' as const, host: 'receiver.example.com', port: 22, hostKeySha256: 'a'.repeat(64), directory: '/incoming', ackDirectory: '/ACK', username: 'assigned', secretVersion: `projects/project-1/secrets/rights-cwr-${'a'.repeat(32)}-the_mlc/versions/1` };
describe('receiver transport trust boundaries', () => {
  it('rejects traversal, unapproved receivers and plaintext protocol', () => {
    for (const change of [{ directory: '/a/../b' }, { ackDirectory: '/./ACK' }, { approved: false }, { protocol: 'ftp' }, { revision: 0 }]) expect(SocietyDeliveryProfileSchema.safeParse({ ...profile, ...change }).success).toBe(false);
  });
  it('limits credential references to project, owner and recipient', () => {
    expect(() => validateSocietySecretReference(profile, 'project-1', 'a'.repeat(32))).not.toThrow();
    expect(() => validateSocietySecretReference(profile, 'another-project', 'a'.repeat(32))).toThrow('Credential');
    expect(() => validateSocietySecretReference(profile, 'project-1', 'b'.repeat(32))).toThrow('Credential');
    expect(() => validateSocietySecretReference({ ...profile, recipient: 'sesac' }, 'project-1', 'a'.repeat(32))).toThrow('Credential');
  });
  it('returns safe capabilities without secrets or network configuration', () => {
    const status = publicSocietyDeliveryStatus(profile, false);
    expect(status.configured).toBe(true); expect(status.enabled).toBe(false);
    for (const key of ['host', 'username', 'secretVersion', 'hostKeySha256']) expect(status).not.toHaveProperty(key);
    expect(publicSocietyDeliveryStatus({ ...profile, approved: false }, true).enabled).toBe(false);
  });
  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.0.1', '172.31.0.1', '192.168.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '999.1.2.3', '::1'])('rejects nonpublic address %s', address => expect(isPublicSocietyIpv4(address)).toBe(false));
  it('accepts public IPv4 only', () => expect(isPublicSocietyIpv4('8.8.8.8')).toBe(true));
});
