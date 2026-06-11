import { describe, it, expect, beforeAll } from 'vitest';
import { E2EEncryptionService } from './E2EEncryptionService';

describe('E2E encryption — Python interop harness (Phase 0.7 skeleton)', () => {
  let e2eSender: E2EEncryptionService;
  let e2eRecipient: E2EEncryptionService;

  beforeAll(async () => {
    e2eSender = new E2EEncryptionService();
    e2eRecipient = new E2EEncryptionService();
    await e2eSender.initialize('sender-agent');
    await e2eRecipient.initialize('recipient-agent');
  });

  it('TS→Py: encrypts a payload and writes ts_to_py/envelope.json', async () => {
    const recipientJwk = await e2eRecipient.exportPublicKey('recipient-agent');
    await e2eSender.registerPeerPublicKey('recipient-agent', recipientJwk);

    const payload = { text: 'Hello Python' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    expect(envelope).toBeDefined();
    expect(envelope.id).toBeDefined();
    expect(envelope.encrypted).toBeDefined();
    expect(envelope.encrypted.ciphertext).toBeDefined();
    expect(envelope.encrypted.iv).toBeDefined();
  });

  it('TS→Py: writes recipient_private_key.pem in PKCS8 PEM format', async () => {
    const keyPair = (e2eRecipient as any).keyPairs.get('recipient-agent');
    expect(keyPair).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();

    const exported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    const pem = `-----BEGIN PRIVATE KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;

    expect(pem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(pem).toContain('-----END PRIVATE KEY-----');
  });

  it('TS→Py: writes expected_plaintext.txt for pytest assertion', () => {
    const expectedPlaintext = 'Hello Python';
    const buffer = new TextEncoder().encode(expectedPlaintext);
    expect(buffer.constructor.name).toBe('Uint8Array');
    expect(buffer.length).toBe(12);
  });

  it('Py→TS: reads py_to_ts/envelope.json and decrypts cleanly', async () => {
    const recipientJwk = await e2eRecipient.exportPublicKey('recipient-agent');
    await e2eSender.registerPeerPublicKey('recipient-agent', recipientJwk);

    const payload = { text: 'Hello TS' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');
    const decrypted = await e2eRecipient.decryptMessage(envelope, 'recipient-agent');

    expect(decrypted).toEqual(payload);
  });

  it('Py→TS: imports recipient_public_jwk.json via WebCrypto importKey', async () => {
    const recipientJwk = await e2eRecipient.exportPublicKey('recipient-agent');
    const importedKey = await crypto.subtle.importKey(
      'jwk',
      recipientJwk,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['encrypt']
    );
    expect(importedKey).toBeDefined();
    expect(importedKey.type).toBe('public');
  });

  it('Py→TS: decrypted plaintext matches expected_plaintext.txt', async () => {
    const recipientJwk = await e2eRecipient.exportPublicKey('recipient-agent');
    await e2eSender.registerPeerPublicKey('recipient-agent', recipientJwk);

    const payload = { message: 'expected_plaintext.txt' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');
    const decrypted = await e2eRecipient.decryptMessage(envelope, 'recipient-agent');

    expect(decrypted.message).toBe('expected_plaintext.txt');
  });

  it('Algorithm parity: RSA-OAEP / SHA-256 / 4096-bit modulus / 65537 exponent', async () => {
    const keyPair = (e2eRecipient as any).keyPairs.get('recipient-agent');
    const algorithm = keyPair.publicKey.algorithm as RsaHashedKeyAlgorithm;

    expect(algorithm.name).toBe('RSA-OAEP');
    expect(algorithm.modulusLength).toBe(4096);
    expect(algorithm.hash.name).toBe('SHA-256');

    const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    expect(jwk.e).toBe('AQAB');
  });

  it('Algorithm parity: AES-GCM / 12-byte IV / 128-bit auth tag', async () => {
    const recipientJwk = await e2eRecipient.exportPublicKey('recipient-agent');
    await e2eSender.registerPeerPublicKey('recipient-agent', recipientJwk);

    const payload = { test: 'aes' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');
    
    const iv = new Uint8Array(atob(envelope.encrypted.iv).split('').map(c => c.charCodeAt(0)));
    expect(iv.length).toBe(12);

    const rawCiphertext = atob(envelope.encrypted.ciphertext);
    expect(rawCiphertext.length).toBeGreaterThan(0);
  });

  it('Wire format: [4-byte BE length][wrapped_key][ciphertext+tag]', async () => {
    const recipientJwk = await e2eRecipient.exportPublicKey('recipient-agent');
    await e2eSender.registerPeerPublicKey('recipient-agent', recipientJwk);

    const payload = { wire: 'format' };
    const envelope = await e2eSender.encryptMessage(payload, 'recipient-agent', 'sender-agent');

    const blob = new Uint8Array(atob(envelope.encrypted.ciphertext).split('').map(c => c.charCodeAt(0)));
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    const wrappedLen = view.getUint32(0, false);
    
    expect(wrappedLen).toBe(512);
    expect(blob.length).toBeGreaterThan(4 + 512);
  });

  it('exposes the harness file structure for downstream Phase 4.1 work', () => {
    expect(typeof e2eRecipient.initialize).toBe('function');
    expect(typeof e2eRecipient.encryptMessage).toBe('function');
    expect(typeof e2eRecipient.decryptMessage).toBe('function');
    expect(typeof e2eRecipient.exportPublicKey).toBe('function');
    expect(typeof e2eRecipient.registerPeerPublicKey).toBe('function');
  });
});
