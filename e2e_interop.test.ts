import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { E2EEncryptionService } from './packages/renderer/src/services/security/E2EEncryptionService';

// Fallback for Node 18/20 crypto
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = require('crypto').webcrypto;
}

function derToPem(derBuffer: ArrayBuffer, type: string) {
  const b64 = Buffer.from(derBuffer).toString('base64');
  const lines = b64.match(/.{1,64}/g)?.join('\n') || b64;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

function pemToDer(pem: string): ArrayBuffer {
  const b64Lines = pem.replace(/-----BEGIN [A-Z ]+-----/, '')
                      .replace(/-----END [A-Z ]+-----/, '')
                      .replace(/\s+/g, '');
  const raw = Buffer.from(b64Lines, 'base64');
  return new Uint8Array(raw).buffer;
}

describe('E2E Interop Fixture Generator', () => {
  it('generates ts_to_py fixture', async () => {
    const e2e = new E2EEncryptionService();
    
    // Initialize sender
    await e2e.initialize('ts-sender');
    
    // Initialize recipient
    const e2eRecipient = new E2EEncryptionService();
    await e2eRecipient.initialize('py-recipient');
    
    const recipientJwk = await e2eRecipient.exportPublicKey('py-recipient');
    await e2e.registerPeerPublicKey('py-recipient', recipientJwk);
    
    const plaintext = "Hello from TypeScript! This is the TS to Py test payload.";
    const messageObj = { plaintext };
    
    const envelope = await e2e.encryptMessage(messageObj, 'py-recipient', 'ts-sender');
    
    // Export recipient private key to PKCS8 PEM
    // @ts-ignore
    const recipientKeyPair = e2eRecipient.keyPairs.get('py-recipient')!;
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', recipientKeyPair.privateKey);
    const pem = derToPem(pkcs8, 'PRIVATE KEY');
    
    const fixtureDir = path.join(process.cwd(), 'python', 'tests', 'fixtures', 'e2e_interop', 'ts_to_py');
    fs.mkdirSync(fixtureDir, { recursive: true });
    
    fs.writeFileSync(path.join(fixtureDir, 'recipient_private_key.pem'), pem);
    fs.writeFileSync(path.join(fixtureDir, 'envelope.json'), JSON.stringify(envelope, null, 2));
    fs.writeFileSync(path.join(fixtureDir, 'expected_plaintext.txt'), JSON.stringify(messageObj));
    
    // Verify round-trip decryption
    const decrypted = await e2eRecipient.decryptMessage(envelope, 'py-recipient');
    if (decrypted.plaintext !== plaintext) {
      throw new Error(`Round-trip failed! Expected ${plaintext}, got ${decrypted.plaintext}`);
    }
    
    console.log('Successfully generated ts_to_py fixtures and verified round-trip!');
  }, 30000);

  it('validates py_to_ts fixture', async () => {
    const fixtureDir = path.join(process.cwd(), 'python', 'tests', 'fixtures', 'e2e_interop', 'py_to_ts');
    
    // Check if fixtures exist
    if (!fs.existsSync(fixtureDir)) {
      console.log('Skipping py_to_ts test: Fixtures not found. Claude will drop them.');
      return;
    }

    const pemKey = fs.readFileSync(path.join(fixtureDir, 'recipient_private_key.pem'), 'utf-8');
    const envelope = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'envelope.json'), 'utf-8'));
    
    // Force current timestamp to bypass 1-hour expiration check during testing
    if (envelope.encrypted) {
      envelope.encrypted.timestamp = Date.now();
    }
    
    const expectedPlaintext = fs.readFileSync(path.join(fixtureDir, 'expected_plaintext.txt'), 'utf-8').trim();

    const derBuffer = pemToDer(pemKey);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      derBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );

    // Create a mock e2e instance to force the private key
    const e2eRecipient = new E2EEncryptionService();
    e2eRecipient['keyPairs'].set('ts-recipient', {
      privateKey,
      publicKey: null as any // not needed for decryption
    });

    const decrypted = await e2eRecipient.decryptMessage(envelope, 'ts-recipient');
    expect(JSON.stringify(decrypted)).toBe(expectedPlaintext);
    console.log('Py -> TS fixture decrypted perfectly!');
  }, 30000);
});
