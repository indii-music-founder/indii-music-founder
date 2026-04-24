import { useEffect, useState, useCallback } from 'react';
import { offlineFirstService } from '@/services/sync/OfflineFirstService';

interface UseSyncStatus {
  isOnline: boolean;
  pendingOperations: number;
  sync: () => Promise<void>;
  queueOperation: (
    collection: string,
    operation: 'create' | 'update' | 'delete',
    data: Record<string, unknown>,
    id?: string
  ) => Promise<string>;
}

/**
 * Hook for offline-first data sync
 *
 * Provides access to offline sync status and operations
 */
export function useOfflineSync(): UseSyncStatus {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    pendingOperations: 0,
  });

  useEffect(() => {
    const updateStatus = () => {
      const currentStatus = offlineFirstService.getStatus();
      setStatus({
        isOnline: currentStatus.isOnline,
        pendingOperations: currentStatus.pendingOperations,
      });
    };

    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    const handleSync = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineSync', handleSync);

    offlineFirstService.startAutoSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineSync', handleSync);
      offlineFirstService.stopAutoSync();
    };
  }, []);

  const sync = useCallback(async () => {
    await offlineFirstService.syncPending();
    const updatedStatus = offlineFirstService.getStatus();
    setStatus({
      isOnline: updatedStatus.isOnline,
      pendingOperations: updatedStatus.pendingOperations,
    });
  }, []);

  const queueOperation = useCallback(
    async (
      collection: string,
      operation: 'create' | 'update' | 'delete',
      data: Record<string, unknown>,
      id?: string
    ) => {
      const result = await offlineFirstService.queueOperation(
        collection,
        operation,
        data,
        id
      );
      const updatedStatus = offlineFirstService.getStatus();
      setStatus({
        isOnline: updatedStatus.isOnline,
        pendingOperations: updatedStatus.pendingOperations,
      });
      return result;
    },
    []
  );

  return {
    isOnline: status.isOnline,
    pendingOperations: status.pendingOperations,
    sync,
    queueOperation,
  };
}
