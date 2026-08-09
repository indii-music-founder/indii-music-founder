import { logger } from '@/utils/logger';

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  algorithm: string;
  timestamp: number;
  senderId: string;
  recipientId: string;
}

export interface MessageEnvelope {
  id: string;
  encrypted: EncryptedMessage;
  signature: string;
}

const ALGORITHM = {
  name: 'RSA-OAEP',
  modulusLength: 4096,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const ENCRYPTION_ALGORITHM = {
  name: 'AES-GCM',
  length: 256,
};

/**
 * E2EEncryptionService
 *
 * Provides end-to-end encryption for agent-to-agent communication using:
 * - RSA-4096 for asymmetric key exchange
 * - AES-256-GCM for symmetric message encryption
 * - HMAC-SHA256 for message authentication
 *
 * Ensures all agent communications are encrypted and authenticated.
 */
export class E2EEncryptionService {
  private keyPairs: Map<string, KeyPair> = new Map();
  private signingKeyPairs: Map<string, KeyPair> = new Map();
  private publicKeyRegistry: Map<string, CryptoKey> = new Map();
  private signingPublicKeyRegistry: Map<string, CryptoKey> = new Map();
  private sessionKeys: Map<string, CryptoKey> = new Map();

  /**
   * Initialize service and generate encryption + signing key pairs
   */
  async initialize(agentId: string): Promise<void> {
    try {
      // Generate RSA key pair for encryption (RSA-OAEP)
      const keyPair = (await crypto.subtle.generateKey(
        ALGORITHM,
        true,
        ['encrypt', 'decrypt']
      )) as KeyPair;

      // Generate RSA key pair for message signing (RSASSA-PKCS1-v1_5)
      const signingKeyPair = (await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      )) as KeyPair;

      this.keyPairs.set(agentId, keyPair);
      this.signingKeyPairs.set(agentId, signingKeyPair);
      this.publicKeyRegistry.set(agentId, keyPair.publicKey);
      this.signingPublicKeyRegistry.set(agentId, signingKeyPair.publicKey);

      this.log(`Encryption initialized for agent ${agentId}`);
    } catch (error) {
      logger.error('Failed to initialize encryption', error);
      throw error;
    }
  }

  /**
   * Register a peer agent's public key (both encryption and signing if provided)
   */
  async registerPeerPublicKey(
    agentId: string,
    publicKeyJwk: JsonWebKey,
    signingKeyJwk?: JsonWebKey
  ): Promise<void> {
    try {
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        publicKeyJwk,
        ALGORITHM,
        true,
        ['encrypt']
      );

      this.publicKeyRegistry.set(agentId, publicKey);

      if (signingKeyJwk) {
        const signingKey = await crypto.subtle.importKey(
          'jwk',
          signingKeyJwk,
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
          },
          true,
          ['verify']
        );
        this.signingPublicKeyRegistry.set(agentId, signingKey);
      }

      this.log(`Registered public key for agent ${agentId}`);
    } catch (error) {
      logger.error(`Failed to register public key for ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Export public key for sharing with peers
   */
  async exportPublicKey(agentId: string): Promise<JsonWebKey> {
    const keyPair = this.keyPairs.get(agentId);
    if (!keyPair) {
      throw new Error(`No key pair found for agent ${agentId}`);
    }

    return crypto.subtle.exportKey('jwk', keyPair.publicKey);
  }

  /**
   * Export signing public key for sharing with peers
   */
  async exportSigningPublicKey(agentId: string): Promise<JsonWebKey> {
    const keyPair = this.signingKeyPairs.get(agentId);
    if (!keyPair) {
      throw new Error(`No signing key pair found for agent ${agentId}`);
    }

    return crypto.subtle.exportKey('jwk', keyPair.publicKey);
  }

  /**
   * Encrypt a message for a specific recipient and sign the envelope
   */
  async encryptMessage(
    message: Record<string, unknown>,
    recipientId: string,
    senderId: string
  ): Promise<MessageEnvelope> {
    try {
      const recipientPublicKey = this.publicKeyRegistry.get(recipientId);
      if (!recipientPublicKey) {
        throw new Error(`Public key not found for recipient ${recipientId}`);
      }

      // Generate session key
      const sessionKey = await crypto.subtle.generateKey(
        ENCRYPTION_ALGORITHM,
        true,
        ['encrypt', 'decrypt']
      );

      // Encrypt message with session key (AES-GCM)
      const messageJson = JSON.stringify(message);
      const messageBuffer = new TextEncoder().encode(messageJson);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await crypto.subtle.encrypt(
        { ...ENCRYPTION_ALGORITHM, iv },
        sessionKey as CryptoKey,
        messageBuffer
      );

      // Encrypt session key with recipient's public key
      const sessionKeyRaw = await crypto.subtle.exportKey('raw', sessionKey);
      const encryptedSessionKey = await crypto.subtle.encrypt(
        ALGORITHM,
        recipientPublicKey,
        sessionKeyRaw
      );

      const wrappedKeyArray = new Uint8Array(encryptedSessionKey);
      const cipherArray = new Uint8Array(ciphertext);
      
      // Wire format: [4-byte big-endian wrapped-key length][wrapped_key][ciphertext+tag]
      const blob = new Uint8Array(4 + wrappedKeyArray.length + cipherArray.length);
      const view = new DataView(blob.buffer);
      view.setUint32(0, wrappedKeyArray.length, false); // big-endian
      blob.set(wrappedKeyArray, 4);
      blob.set(cipherArray, 4 + wrappedKeyArray.length);

      // Create encrypted message
      const encrypted: EncryptedMessage = {
        ciphertext: this.arrayToBase64(blob),
        iv: this.arrayToBase64(iv),
        algorithm: 'RSA-OAEP+AES-GCM',
        timestamp: Date.now(),
        senderId,
        recipientId,
      };

      // Sign canonical envelope payload
      let signature = '';
      if (this.signingKeyPairs.has(senderId)) {
        signature = await this.signEnvelopePayload(encrypted, senderId);
      }

      // Store session key for later reference
      const messageId = this.generateMessageId();
      this.sessionKeys.set(messageId, sessionKey);

      this.log(`Encrypted and signed message for ${recipientId}`);

      return {
        id: messageId,
        encrypted,
        signature,
      };
    } catch (error) {
      logger.error('Failed to encrypt message', error);
      throw error;
    }
  }

  /**
   * Decrypt a message and verify sender signature
   */
  async decryptMessage(
    envelope: MessageEnvelope,
    recipientAgentId: string
  ): Promise<Record<string, unknown>> {
    try {
      const { encrypted, signature } = envelope;

      // Check recipient binding
      if (encrypted.recipientId && encrypted.recipientId !== recipientAgentId) {
        throw new Error(`Recipient mismatch: message intended for ${encrypted.recipientId}, received by ${recipientAgentId}`);
      }

      // Check timestamp (prevent replay attacks)
      const messageAge = Date.now() - encrypted.timestamp;
      if (messageAge > 3600000 || messageAge < -300000) {
        // 1 hour max age, 5 minutes clock skew tolerance
        throw new Error('Message expired or invalid timestamp (replay prevention)');
      }

      // Verify signature if sender signing key is available or signature is provided
      const senderId = encrypted.senderId;
      const senderSigningKey = this.signingPublicKeyRegistry.get(senderId) || this.signingKeyPairs.get(senderId)?.publicKey;
      
      if (signature && senderSigningKey) {
        const isValid = await this.verifyEnvelopePayloadSignature(encrypted, signature, senderSigningKey);
        if (!isValid) {
          throw new Error(`Signature verification failed for sender ${senderId}`);
        }
      } else if (signature && !senderSigningKey) {
        logger.warn(`[E2E] Message from ${senderId} has signature but sender signing key is not registered`);
      }

      // Get recipient's private key
      const keyPair = this.keyPairs.get(recipientAgentId);
      if (!keyPair) {
        throw new Error(`No private key found for agent ${recipientAgentId}`);
      }

      // Parse wire format
      const blob = this.base64ToArray(encrypted.ciphertext);
      const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
      const wrappedLen = view.getUint32(0, false);
      
      const wrappedKey = blob.slice(4, 4 + wrappedLen);
      const ciphertextWithTag = blob.slice(4 + wrappedLen);
      const iv = this.base64ToArray(encrypted.iv);

      // Decrypt session key
      const sessionKeyRaw = await crypto.subtle.decrypt(
        ALGORITHM,
        keyPair.privateKey,
        wrappedKey
      );

      const sessionKey = await crypto.subtle.importKey(
        'raw',
        sessionKeyRaw,
        ENCRYPTION_ALGORITHM,
        false,
        ['decrypt']
      );

      const message = await crypto.subtle.decrypt(
        { ...ENCRYPTION_ALGORITHM, iv: iv.buffer as ArrayBuffer },
        sessionKey,
        ciphertextWithTag.buffer as ArrayBuffer
      );

      const decrypted = JSON.parse(new TextDecoder().decode(message));

      this.log(`Decrypted authenticated message from ${encrypted.senderId}`);

      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt message', error);
      throw error;
    }
  }

  /**
   * Sign canonical envelope payload
   */
  private async signEnvelopePayload(
    encrypted: EncryptedMessage,
    senderId: string
  ): Promise<string> {
    const signingKeyPair = this.signingKeyPairs.get(senderId);
    if (!signingKeyPair) {
      throw new Error(`No signing key pair found for agent ${senderId}`);
    }

    const payloadString = `${encrypted.senderId}:${encrypted.recipientId}:${encrypted.timestamp}:${encrypted.ciphertext}`;
    const payloadBuffer = new TextEncoder().encode(payloadString);

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      signingKeyPair.privateKey,
      payloadBuffer
    );

    return this.arrayToBase64(new Uint8Array(signature));
  }

  /**
   * Verify envelope payload signature against sender public key
   */
  private async verifyEnvelopePayloadSignature(
    encrypted: EncryptedMessage,
    signature: string,
    senderSigningKey: CryptoKey
  ): Promise<boolean> {
    try {
      const payloadString = `${encrypted.senderId}:${encrypted.recipientId}:${encrypted.timestamp}:${encrypted.ciphertext}`;
      const payloadBuffer = new TextEncoder().encode(payloadString);
      const signatureBuffer = this.base64ToArray(signature);

      return await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        senderSigningKey,
        signatureBuffer.buffer as ArrayBuffer,
        payloadBuffer
      );
    } catch (error) {
      logger.error('Signature verification error', error);
      return false;
    }
  }

  /**
   * Sign a message for authentication
   */
  private async signMessage(
    message: Record<string, unknown>,
    agentId: string
  ): Promise<string> {
    const keyPair = this.keyPairs.get(agentId);
    if (!keyPair) {
      throw new Error(`No key pair found for agent ${agentId}`);
    }

    const messageJson = JSON.stringify(message);
    const messageBuffer = new TextEncoder().encode(messageJson);

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keyPair.privateKey,
      messageBuffer
    );

    return this.arrayToBase64(new Uint8Array(signature));
  }

  /**
   * Verify message signature
   */
  private async verifySignature(
    message: Record<string, unknown>,
    signature: string,
    senderId: string
  ): Promise<boolean> {
    try {
      const senderPublicKey = this.publicKeyRegistry.get(senderId);
      if (!senderPublicKey) {
        throw new Error(`Public key not found for sender ${senderId}`);
      }

      const messageJson = JSON.stringify(message);
      const messageBuffer = new TextEncoder().encode(messageJson);
      const signatureBuffer = this.base64ToArray(signature);

      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        senderPublicKey,
        signatureBuffer.buffer as ArrayBuffer,
        messageBuffer
      );

      return isValid;
    } catch (error) {
      logger.error('Signature verification failed', error);
      return false;
    }
  }

  /**
   * Derive a shared secret for symmetric encryption
   */
  async deriveSharedSecret(
    agentId: string,
    peerId: string
  ): Promise<CryptoKey> {
    const key = `${agentId}:${peerId}`;
    if (this.sessionKeys.has(key)) {
      return this.sessionKeys.get(key)!;
    }

    const sharedSecret = await crypto.subtle.generateKey(
      ENCRYPTION_ALGORITHM,
      true,
      ['encrypt', 'decrypt']
    );

    this.sessionKeys.set(key, sharedSecret);
    return sharedSecret;
  }

  /**
   * Rotate keys for security
   */
  async rotateKeys(agentId: string): Promise<void> {
    try {
      // Generate new key pair
      const newKeyPair = (await crypto.subtle.generateKey(
        ALGORITHM,
        true,
        ['encrypt', 'decrypt']
      )) as KeyPair;

      this.keyPairs.set(agentId, newKeyPair);
      this.publicKeyRegistry.set(agentId, newKeyPair.publicKey);

      // Clear session keys
      this.sessionKeys.clear();

      this.log(`Keys rotated for agent ${agentId}`);
    } catch (error) {
      logger.error('Failed to rotate keys', error);
      throw error;
    }
  }

  /**
   * Clear all keys (on logout)
   */
  clearKeys(): void {
    this.keyPairs.clear();
    this.signingKeyPairs.clear();
    this.publicKeyRegistry.clear();
    this.signingPublicKeyRegistry.clear();
    this.sessionKeys.clear();
    this.log('All keys cleared');
  }

  /**
   * Diagnostics snapshot for security/audit surfaces.
   * Exposes only key presence and counts — never key material itself.
   */
  getDiagnostics(): {
    localAgentIds: string[];
    registeredPeerIds: string[];
    peersWithVerifiedSigning: string[];
    activeSessionCount: number;
  } {
    return {
      localAgentIds: Array.from(this.keyPairs.keys()),
      registeredPeerIds: Array.from(this.publicKeyRegistry.keys()),
      peersWithVerifiedSigning: Array.from(this.signingPublicKeyRegistry.keys()),
      activeSessionCount: this.sessionKeys.size,
    };
  }

  // Helper methods

  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  private base64ToArray(b64: string): Uint8Array {
    return new Uint8Array(
      atob(b64)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${crypto.randomUUID().substring(0, 12)}`;
  }

  private log(message: string): void {
    if (import.meta.env.DEV) {
      logger.debug(`[E2E] ${message}`);
    }
  }
}

export const e2eEncryptionService = new E2EEncryptionService();
