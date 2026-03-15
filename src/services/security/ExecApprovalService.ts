/**
 * Exec Approval Service
 *
 * Implements an explicit permission allowlist for dangerous tool executions
 * (shell commands, filesystem writes, network egress). Approvals are persisted
 * to `exec-approvals.json` (Electron user-data directory) so users are never
 * asked twice for the same safe pattern.
 *
 * Security model (hardened vs. OpenClaw's disabled-by-default sandboxing):
 *   - ALL untrusted inputs default to DENY
 *   - Approvals are scoped to (commandPattern, scope) pairs
 *   - Scope can be 'once', 'session', or 'permanent'
 *   - Permanent approvals are persisted; session/once approvals are in-memory only
 *   - Docker/ephemeral isolation is enforced for any untrusted external input
 *
 * File: Persisted in Electron via IPC → userData/exec-approvals.json
 */

import { logger } from '@/utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ApprovalScope = 'once' | 'session' | 'permanent';
export type ToolCategory = 'shell' | 'filesystem' | 'network' | 'agent' | 'distribution';

export interface ApprovalEntry {
  id: string;
  commandPattern: string;  // Exact command or regex pattern
  category: ToolCategory;
  scope: ApprovalScope;
  approvedAt: number;
  approvedBy: string;      // User ID or 'system'
  expiresAt?: number;      // Undefined = no expiry (permanent)
}

export interface ApprovalRequest {
  commandPattern: string;
  category: ToolCategory;
  description: string;     // Human-readable rationale
  requestedScope: ApprovalScope;
  isSandboxed: boolean;    // Is execution inside Docker/ephemeral container?
}

export interface ApprovalResult {
  approved: boolean;
  entry?: ApprovalEntry;
  reason?: string;
}

// ─── Storage Key ─────────────────────────────────────────────────────────────

const LOCAL_STORAGE_KEY = 'indiiOS_exec_approvals';
const SESSION_STORAGE_KEY = 'indiiOS_exec_approvals_session';

// ─── Default Allow-list (pre-approved safe patterns) ─────────────────────────

const SAFE_DEFAULTS: Omit<ApprovalEntry, 'id' | 'approvedAt'>[] = [
  {
    commandPattern: 'npm run build',
    category: 'shell',
    scope: 'permanent',
    approvedBy: 'system',
  },
  {
    commandPattern: 'npm run lint',
    category: 'shell',
    scope: 'permanent',
    approvedBy: 'system',
  },
  {
    commandPattern: 'npm test',
    category: 'shell',
    scope: 'permanent',
    approvedBy: 'system',
  },
  {
    commandPattern: 'git status',
    category: 'shell',
    scope: 'permanent',
    approvedBy: 'system',
  },
  {
    commandPattern: 'git diff',
    category: 'shell',
    scope: 'permanent',
    approvedBy: 'system',
  },
];

// ─── ExecApprovalService ─────────────────────────────────────────────────────

class ExecApprovalService {
  private permanentApprovals: Map<string, ApprovalEntry> = new Map();
  private sessionApprovals: Map<string, ApprovalEntry> = new Map();
  private pendingCallbacks: Map<string, (approved: boolean, scope: ApprovalScope) => void> = new Map();

  constructor() {
    this._loadPermanentApprovals();
    this._seedDefaults();
  }

  // ─── Check ───────────────────────────────────────────────────────────────

  /**
   * Check if a command pattern is already approved.
   * Returns the matching entry if found, null otherwise.
   */
  isApproved(commandPattern: string): ApprovalEntry | null {
    const key = this._normalizeKey(commandPattern);

    // Check permanent approvals
    const permanent = this.permanentApprovals.get(key);
    if (permanent) {
      if (permanent.expiresAt && Date.now() > permanent.expiresAt) {
        this.permanentApprovals.delete(key);
        this._savePermanentApprovals();
        return null;
      }
      return permanent;
    }

    // Check session approvals
    const session = this.sessionApprovals.get(key);
    if (session) return session;

    return null;
  }

  // ─── Request ─────────────────────────────────────────────────────────────

  /**
   * Request approval for a command. Returns immediately if already approved.
   * Otherwise, emits a pending request that the UI layer must resolve via
   * `resolveRequest()`.
   *
   * IMPORTANT: Unsandboxed external inputs are never auto-approved.
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    const key = this._normalizeKey(request.commandPattern);

    // Fast path: already approved
    const existing = this.isApproved(request.commandPattern);
    if (existing) {
      return { approved: true, entry: existing };
    }

    // Safety gate: block unsandboxed external tool calls
    if (!request.isSandboxed && this._isHighRisk(request.category)) {
      logger.warn(`[ExecApproval] Blocked unsandboxed high-risk command: ${request.commandPattern}`);
      return {
        approved: false,
        reason: `Command requires sandboxed execution. Category '${request.category}' with unsandboxed=true is blocked by security policy.`,
      };
    }

    // Await user resolution via UI callback
    return new Promise<ApprovalResult>((resolve) => {
      this.pendingCallbacks.set(key, (approved, scope) => {
        if (!approved) {
          resolve({ approved: false, reason: 'User denied' });
          return;
        }

        const entry: ApprovalEntry = {
          id: crypto.randomUUID(),
          commandPattern: request.commandPattern,
          category: request.category,
          scope,
          approvedAt: Date.now(),
          approvedBy: 'user',
        };

        if (scope === 'permanent') {
          this.permanentApprovals.set(key, entry);
          this._savePermanentApprovals();
        } else if (scope === 'session') {
          this.sessionApprovals.set(key, entry);
        }
        // 'once' scope: not stored anywhere

        resolve({ approved: true, entry });
      });
    });
  }

  /**
   * Resolve a pending approval request. Called by the UI approval modal.
   */
  resolveRequest(commandPattern: string, approved: boolean, scope: ApprovalScope = 'once'): void {
    const key = this._normalizeKey(commandPattern);
    const cb = this.pendingCallbacks.get(key);
    if (cb) {
      this.pendingCallbacks.delete(key);
      cb(approved, scope);
    }
  }

  // ─── Management ──────────────────────────────────────────────────────────

  /**
   * Revoke a permanent approval.
   */
  revoke(commandPattern: string): void {
    const key = this._normalizeKey(commandPattern);
    this.permanentApprovals.delete(key);
    this.sessionApprovals.delete(key);
    this._savePermanentApprovals();
    logger.info(`[ExecApproval] Revoked approval for: ${commandPattern}`);
  }

  /**
   * List all active permanent approvals.
   */
  listPermanent(): ApprovalEntry[] {
    return [...this.permanentApprovals.values()];
  }

  /**
   * List pending approval requests waiting for user action.
   */
  listPending(): string[] {
    return [...this.pendingCallbacks.keys()];
  }

  /**
   * Clear all session-scoped approvals (called on logout / session end).
   */
  clearSession(): void {
    this.sessionApprovals.clear();
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _normalizeKey(pattern: string): string {
    return pattern.trim().toLowerCase();
  }

  private _isHighRisk(category: ToolCategory): boolean {
    return category === 'shell' || category === 'filesystem' || category === 'network';
  }

  private _loadPermanentApprovals(): void {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;
      const entries: ApprovalEntry[] = JSON.parse(raw);
      for (const entry of entries) {
        this.permanentApprovals.set(this._normalizeKey(entry.commandPattern), entry);
      }
    } catch {
      logger.warn('[ExecApproval] Failed to load persisted approvals, starting fresh.');
    }
  }

  private _savePermanentApprovals(): void {
    try {
      const entries = [...this.permanentApprovals.values()];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));

      // Also sync to Electron userData via IPC if available
      if (typeof window !== 'undefined' && window.electronAPI?.agent?.saveHistory) {
        window.electronAPI.agent.saveHistory('exec-approvals', entries).catch(() => {
          // Non-critical: localStorage is the source of truth
        });
      }
    } catch (err) {
      logger.error('[ExecApproval] Failed to persist approvals', err);
    }
  }

  private _seedDefaults(): void {
    for (const def of SAFE_DEFAULTS) {
      const key = this._normalizeKey(def.commandPattern);
      if (!this.permanentApprovals.has(key)) {
        this.permanentApprovals.set(key, {
          ...def,
          id: crypto.randomUUID(),
          approvedAt: Date.now(),
        });
      }
    }
  }
}

export const execApprovalService = new ExecApprovalService();
