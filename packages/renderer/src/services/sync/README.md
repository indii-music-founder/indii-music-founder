# Sync Services

Offline-first data synchronization for indiiOS, enabling seamless operation when network connectivity is unavailable.

## Services

### OfflineFirstService

Provides offline-first data persistence and sync queue management using IndexedDB.

**Features:**
- Local data persistence with IndexedDB
- Automatic sync queue management
- Offline/online detection
- Exponential backoff retry (up to 5 retries by default)
- Conflict resolution hooks
- Periodic auto-sync (30-second intervals)

**Usage:**

```typescript
import { offlineFirstService } from '@/services/sync/OfflineFirstService';

// Queue an operation for sync when online
await offlineFirstService.queueOperation('tracks', 'create', {
  name: 'My Track',
  duration: 180,
});

// Save data locally for offline access
await offlineFirstService.saveOfflineData('projects', 'proj-123', projectData);

// Retrieve offline data
const data = await offlineFirstService.getOfflineData('projects', 'proj-123');

// Get sync status
const status = offlineFirstService.getStatus();
// { isOnline: true, pendingOperations: 2 }

// Manual sync trigger
await offlineFirstService.syncPending();
```

## Hooks

### useOfflineSync

React hook for offline sync functionality in components.

**Example:**

```typescript
import { useOfflineSync } from '@/hooks/useOfflineSync';

function MyComponent() {
  const { isOnline, pendingOperations, sync, queueOperation } = useOfflineSync();

  if (!isOnline) {
    return <div>You are offline. Changes will sync when online.</div>;
  }

  return (
    <div>
      <p>Pending operations: {pendingOperations}</p>
      <button onClick={sync}>Sync Now</button>
    </div>
  );
}
```

## Sync Workflow

1. **Offline Detection** - Service listens for online/offline events
2. **Operation Queuing** - Operations are queued in memory and IndexedDB
3. **Local Persistence** - Data is saved locally for immediate access
4. **Auto-Sync Loop** - Periodically attempts to sync when online
5. **Retry Logic** - Failed syncs retry up to 5 times with exponential backoff
6. **Status Updates** - Components can subscribe to sync status changes

## Data Structures

### SyncItem
```typescript
interface SyncItem {
  id: string;
  collection: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}
```

### Status
```typescript
interface SyncStatus {
  isOnline: boolean;
  pendingOperations: number;
  lastSync?: number;
}
```

## Integration Points

Apps should listen to the `offlineSync` event to implement custom sync logic:

```typescript
window.addEventListener('offlineSync', (event: CustomEvent<SyncItem>) => {
  const { collection, operation, data, id } = event.detail;
  
  // Implement actual Firestore sync here
  if (operation === 'create') {
    // Create document in Firestore
  } else if (operation === 'update') {
    // Update document in Firestore
  } else if (operation === 'delete') {
    // Delete document from Firestore
  }
});
```

## Configuration

```typescript
const service = new OfflineFirstService({
  maxRetries: 5,        // Max retry attempts
  syncInterval: 30000,  // Sync check interval (ms)
  enableLogging: true,  // Debug logging
});
```

## Item #28 - Platinum Release

This service implements the TOP_50 Platinum Release Item #28:
> "Add offline-first data sync for Firestore (beyond PWA cache)"

Provides applications with transparent offline data persistence, queuing, and sync capabilities.
