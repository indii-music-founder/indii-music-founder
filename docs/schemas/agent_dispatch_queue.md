# Agent Dispatch Queue Schema

**Collection:** `users/{userId}/agent_dispatch_queue`

This collection acts as the core communication layer between the Mobile Remote App (Pocket Assistant) and the Desktop Executor (Electron + MCP). It is designed to be highly secure, supporting the "Zero-Local-Data" philosophy.

## Document Structure (`users/{userId}/agent_dispatch_queue/{taskId}`)

```typescript
interface AgentDispatchTask {
  id: string;                 // Auto-generated Firestore ID
  userId: string;             // The UID of the authenticated user
  
  // Task Definition
  type: 'voice_memo' | 'quick_contact' | 'receipt_log' | 'agent_command';
  payload: {
    // For voice_memo / quick_contact
    audioUrl?: string;        // gs:// url to raw audio in Firebase Storage
    transcription?: string;   // Optional fallback/pre-processed text
    
    // For receipt_log
    imageUrl?: string;        // gs:// url to receipt image
    amount?: number;
    
    // For agent_command
    commandText?: string;     // Text command for the AI Conductor
  };
  
  // Execution State
  status: 'pending' | 'processing' | 'completed' | 'failed';
  executorId?: string;        // The machine ID of the desktop that picked this up
  
  // Timestamps
  createdAt: number;          // Unix timestamp (ms)
  pickedUpAt?: number;        // Unix timestamp (ms)
  completedAt?: number;       // Unix timestamp (ms)
  
  // Error Handling
  error?: {
    code: string;
    message: string;
  };
}
```

## Security & Sync Model
1. **Creation:** Mobile app creates a new task with `status: 'pending'`.
2. **Execution:** The Desktop Electron app listens for `status == 'pending'` where `userId == Desktop.userId`. It updates `status` to `'processing'`, executes the MCP tool, and then updates to `'completed'`.
3. **Immutability:** Once `status` is `'completed'`, the task is read-only.
4. **Resiliency:** If a task sits in `'processing'` for > 5 minutes, it is considered abandoned (desktop crash) and can be reset to `'pending'` by the client.
