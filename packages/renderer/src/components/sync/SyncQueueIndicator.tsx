import React, { useState, useCallback } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useMobile } from '@/hooks/useMobile';
import {
  AlertCircle,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncQueueIndicatorProps {
  className?: string;
}

/**
 * SyncQueueIndicator
 *
 * Shows pending offline operations status.
 * Displays as a badge when there are pending items or device is offline.
 */
export const SyncQueueIndicator: React.FC<SyncQueueIndicatorProps> = ({
  className,
}) => {
  const { isOnline, pendingOperations, sync } = useOfflineSync();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await sync();
    } finally {
      setIsRetrying(false);
    }
  }, [sync]);

  // Don't show if online and no pending operations
  if (isOnline && pendingOperations === 0) {
    return null;
  }

  const badgeColor = isOnline ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  const statusText = isOnline
    ? `${pendingOperations} pending`
    : 'Offline';

  return (
    <div className={cn('flex items-center', className)}>
      <button
        onClick={handleRetry}
        disabled={isRetrying || !isOnline}
        className={cn(
          'relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          badgeColor,
          isRetrying && 'opacity-75'
        )}
        title={isOnline ? 'Click to sync pending changes' : 'You are offline'}
      >
        {isOnline ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}

        <span>{statusText}</span>

        {pendingOperations > 0 && isRetrying && (
          <RefreshCw className="h-3 w-3 animate-spin" />
        )}
      </button>
    </div>
  );
};
