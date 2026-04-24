import { useEffect, useState } from 'react';
import { e2eEncryptionService } from '@/services/security/E2EEncryptionService';
import type { MessageEnvelope } from '@/services/security/E2EEncryptionService';

interface UseE2EEncryptionReturn {
  isInitialized: boolean;
  error: Error | null;
  encrypt: (
    message: Record<string, unknown>,
    recipientId: string,
    senderId: string
  ) => Promise<MessageEnvelope>;
  decrypt: (
    envelope: MessageEnvelope,
    recipientAgentId: string
  ) => Promise<Record<string, unknown>>;
  exportPublicKey: (agentId: string) => Promise<JsonWebKey>;
  registerPeerPublicKey: (agentId: string, publicKeyJwk: JsonWebKey) => Promise<void>;
}

/**
 * Hook for end-to-end encryption in agent communication
 */
export function useE2EEncryption(agentId?: string): UseE2EEncryptionReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const initializeEncryption = async () => {
      try {
        await e2eEncryptionService.initialize(agentId);
        setIsInitialized(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
      }
    };

    initializeEncryption();

    return () => {
      e2eEncryptionService.clearKeys();
      setIsInitialized(false);
    };
  }, [agentId]);

  return {
    isInitialized,
    error,
    encrypt: e2eEncryptionService.encryptMessage.bind(e2eEncryptionService),
    decrypt: e2eEncryptionService.decryptMessage.bind(e2eEncryptionService),
    exportPublicKey: e2eEncryptionService.exportPublicKey.bind(e2eEncryptionService),
    registerPeerPublicKey: e2eEncryptionService.registerPeerPublicKey.bind(
      e2eEncryptionService
    ),
  };
}
