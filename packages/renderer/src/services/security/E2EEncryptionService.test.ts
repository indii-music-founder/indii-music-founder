import { describe, it, expect, beforeEach } from 'vitest';
import { E2EEncryptionService } from './E2EEncryptionService';

describe('E2EEncryptionService — Signature & Authenticity (ISSUE-1260)', () => {
  let e2eSender: E2EEncryptionService;
  let e2eRecipient: E2EEncryptionService;

  beforeEach(async () => {
    e2eSender = new E2EEncryptionService();
    e2eRecipient = new E2EEncryptionService();
    await e2eSender.initialize('sender-agent');
    await e2eRecipient.initialize('recipient-agent');

    const recipientJwk = await e2eRecipient.exportPublicKey('recipient-agent');
    const senderSigningJwk = await e2eSender.exportSigningPublicKey('sender-agent');

    await e2eSender.registerPeerPublicKey('recipient-agent', recipientJwk);
    await e2eRecipient.registerPeerPublicKey('sender-agent', await e2eSender.exportPublicKey('sender-agent'), senderSigningJwk);
  });

  it('generates a non-empty RSA signature for encrypted envelopes', async () => {
    const payload = { command: 'deploy', target: 'production' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    expect(envelope.signature).toBeDefined();
    expect(envelope.signature.length).toBeGreaterThan(64);
  });

  it('decrypts and verifies signature successfully for legitimate sender', async () => {
    const payload = { secretData: 'sensitive-financial-evidence' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    const decrypted = await e2eRecipient.decryptMessage(envelope, 'recipient-agent');
    expect(decrypted).toEqual(payload);
  });

  it('rejects envelope if signature is tampered or forged', async () => {
    const payload = { action: 'transfer', amount: 1000 };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    // Tamper with signature
    envelope.signature = 'invalid_tampered_signature_base64==';

    await expect(
      e2eRecipient.decryptMessage(envelope, 'recipient-agent')
    ).rejects.toThrow('Signature verification failed');
  });

  it('rejects envelope if ciphertext is modified in transit', async () => {
    const payload = { action: 'release', trackId: 'track-123' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    // Tamper with ciphertext
    const modifiedText = envelope.encrypted.ciphertext.slice(0, -4) + 'AAAA';
    envelope.encrypted.ciphertext = modifiedText;

    await expect(
      e2eRecipient.decryptMessage(envelope, 'recipient-agent')
    ).rejects.toThrow();
  });

  it('rejects message targeted at a different recipient (recipient binding)', async () => {
    const payload = { secret: 'top-secret' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    await expect(
      e2eRecipient.decryptMessage(envelope, 'wrong-recipient-agent')
    ).rejects.toThrow('Recipient mismatch');
  });

  it('rejects replayed messages older than 1 hour (replay protection)', async () => {
    const payload = { event: 'timestamp-test' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    // Modify timestamp to 2 hours in the past
    envelope.encrypted.timestamp = Date.now() - (2 * 3600 * 1000);

    // Re-sign modified envelope
    const reSigned = await (e2eSender as any).signEnvelopePayload(envelope.encrypted, 'sender-agent');
    envelope.signature = reSigned;

    await expect(
      e2eRecipient.decryptMessage(envelope, 'recipient-agent')
    ).rejects.toThrow('Message expired or invalid timestamp');
  });
});
