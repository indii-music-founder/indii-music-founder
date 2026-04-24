# End-to-End Encryption for Agent Communication

Complete encryption framework for secure agent-to-agent communication in indiiOS.

## Overview

This system ensures that all inter-agent communications are encrypted and authenticated using modern cryptography standards.

**Algorithms:**
- **Asymmetric:** RSA-4096 for key exchange and digital signatures
- **Symmetric:** AES-256-GCM for message encryption
- **Hashing:** SHA-256 for key derivation and integrity
- **Authentication:** HMAC-SHA256 and RSASSA-PKCS1-v1_5 signatures

## Architecture

### Key Components

1. **RSA Key Pairs** (Per-Agent)
   - 4096-bit RSA keys for each agent
   - Public key shared with peers
   - Private key stored securely locally

2. **Session Keys** (Per-Conversation)
   - AES-256 keys derived per agent pair
   - Used for efficient symmetric encryption
   - Automatically managed by service

3. **Message Envelopes**
   - Encrypted payload
   - Authentication signature
   - Timestamp and metadata
   - Replay attack prevention

### Encryption Flow

```
Sender (Agent A)                    Recipient (Agent B)
     |                                     |
     ├─ Generate session key              |
     ├─ Encrypt message with session key  |
     ├─ Encrypt session key with B's pub  |
     ├─ Sign encrypted message            |
     └─ Send envelope ──────────────────> |
                                         |
                                    ├─ Verify signature
                                    ├─ Check timestamp
                                    ├─ Decrypt session key
                                    ├─ Decrypt message
                                    └─ Return plaintext
```

## API Reference

### E2EEncryptionService

#### Initialize

```typescript
import { e2eEncryptionService } from '@/services/security/E2EEncryptionService';

// Generate keys for an agent
await e2eEncryptionService.initialize('agent-123');
```

#### Export Public Key

```typescript
const publicKeyJwk = await e2eEncryptionService.exportPublicKey('agent-123');
// Share with peers via secure channel
```

#### Register Peer Public Key

```typescript
await e2eEncryptionService.registerPeerPublicKey('peer-agent-id', publicKeyJwk);
```

#### Encrypt Message

```typescript
const envelope = await e2eEncryptionService.encryptMessage(
  { action: 'execute', task: 'generate_image' },
  'recipient-agent-id',
  'sender-agent-id'
);
// Send envelope to recipient
```

#### Decrypt Message

```typescript
const message = await e2eEncryptionService.decryptMessage(
  receivedEnvelope,
  'my-agent-id'
);
```

#### Rotate Keys

```typescript
// Periodically rotate keys for security
await e2eEncryptionService.rotateKeys('agent-123');
```

#### Clear Keys

```typescript
// On logout or session end
e2eEncryptionService.clearKeys();
```

## React Hook Usage

### useE2EEncryption

```typescript
import { useE2EEncryption } from '@/hooks/useE2EEncryption';

function AgentCommunication() {
  const {
    isInitialized,
    error,
    encrypt,
    decrypt,
    exportPublicKey,
    registerPeerPublicKey,
  } = useE2EEncryption('my-agent-id');

  if (error) {
    return <div>Encryption error: {error.message}</div>;
  }

  if (!isInitialized) {
    return <div>Initializing encryption...</div>;
  }

  const sendSecureMessage = async () => {
    const envelope = await encrypt(
      { command: 'execute_workflow' },
      'peer-agent-id',
      'my-agent-id'
    );
    // Send envelope via network
  };

  return (
    <div>
      <button onClick={sendSecureMessage}>Send Secure Message</button>
    </div>
  );
}
```

## Data Structures

### MessageEnvelope

```typescript
interface MessageEnvelope {
  id: string;                    // Unique message ID
  encrypted: EncryptedMessage;   // Encrypted payload
  signature: string;              // RSASSA-PKCS1-v1_5 signature
}
```

### EncryptedMessage

```typescript
interface EncryptedMessage {
  ciphertext: string;      // Base64-encoded AES-GCM ciphertext
  iv: string;              // Base64-encoded initialization vector
  algorithm: string;       // "AES-GCM"
  timestamp: number;       // Message creation time (replay prevention)
  senderId: string;        // Sending agent ID
  recipientId: string;     // Recipient agent ID
}
```

## Security Features

### 1. Confidentiality
- AES-256-GCM provides authenticated encryption
- Session keys encrypted with RSA-4096
- Ciphertext cannot be read without private key

### 2. Authenticity
- RSASSA-PKCS1-v1_5 signature on encrypted messages
- Signature verification before decryption
- Prevents message forgery and tampering

### 3. Integrity
- AES-GCM includes authentication tag
- Detects any modification to ciphertext
- Combined with signature verification

### 4. Replay Attack Prevention
- Timestamp validation (1-hour window)
- Message ID uniqueness check
- Service tracks recent message IDs

### 5. Key Management
- Per-agent RSA key pairs
- Per-session symmetric keys
- Automatic key rotation support
- Secure key storage in memory

## Implementation Details

### Key Generation

```typescript
// RSA-4096 key pair generation
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'RSA-OAEP',
    modulusLength: 4096,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['encrypt', 'decrypt']
);
```

### Message Encryption

```typescript
// AES-256-GCM with 12-byte IV
const ciphertext = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  sessionKey,
  messageBuffer
);
```

### Signature

```typescript
// RSASSA-PKCS1-v1_5 with SHA-256
const signature = await crypto.subtle.sign(
  'RSASSA-PKCS1-v1_5',
  privateKey,
  messageBuffer
);
```

## Best Practices

1. **Key Distribution**
   - Exchange public keys through authenticated channels
   - Do not include private keys in any message
   - Store public key registry securely

2. **Key Rotation**
   - Rotate keys periodically (e.g., monthly)
   - Update all peers with new public keys
   - Clear old session keys after rotation

3. **Error Handling**
   - Log encryption failures for debugging
   - Never return decryption errors to untrusted sources
   - Fail securely on missing keys

4. **Performance**
   - Reuse session keys for multiple messages
   - Cache public keys to avoid repeated imports
   - Use asynchronous operations

5. **Compliance**
   - Document encryption usage for audit trails
   - Maintain key rotation logs
   - Monitor for unusual encryption patterns

## Integration with Agent Communication

```typescript
// In agent orchestration layer

async function sendSecureAgentMessage(
  sourceAgent: Agent,
  targetAgent: Agent,
  message: AgentMessage
) {
  // Ensure both agents have keys initialized
  if (!sourceAgent.encryptionInitialized) {
    await e2eEncryptionService.initialize(sourceAgent.id);
  }

  // Encrypt message
  const envelope = await e2eEncryptionService.encryptMessage(
    message,
    targetAgent.id,
    sourceAgent.id
  );

  // Send via transport layer
  await sendMessageToAgent(targetAgent, envelope);
}

async function receiveSecureAgentMessage(
  targetAgent: Agent,
  envelope: MessageEnvelope
) {
  // Decrypt and verify
  const message = await e2eEncryptionService.decryptMessage(
    envelope,
    targetAgent.id
  );

  // Process decrypted message
  return processAgentMessage(targetAgent, message);
}
```

## Troubleshooting

### Missing Public Key Error
```
Error: Public key not found for recipient agent-123
```
**Solution:** Register peer's public key first:
```typescript
await e2eEncryptionService.registerPeerPublicKey(peerId, publicKeyJwk);
```

### Signature Verification Failed
- Verify message wasn't modified in transit
- Check sender's public key is correct
- Ensure timestamp is within 1-hour window

### Decryption Failed
- Verify private key matches encrypted session key
- Check IV is correct
- Ensure AES-GCM ciphertext hasn't been modified

## Item #43 - Platinum Release

This implementation completes TOP_50 Item #43:
> "Add end-to-end encryption for sensitive agent-to-agent communication"

Features:
- RSA-4096 asymmetric encryption
- AES-256-GCM symmetric encryption
- RSASSA-PKCS1-v1_5 digital signatures
- Replay attack prevention
- Automatic key management
- React hook integration
- Per-agent and per-session key management
