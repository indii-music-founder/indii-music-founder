/**
 * Captain's Logs Service — Layer 4 of the IndiiOS Memory Architecture
 *
 * The operational timeline and execution log. Captures daily tasks, errors,
 * heartbeat check results, and execution decisions in sequential order.
 *
 * Philosophy:
 * - Append-only: entries are never modified or deleted.
 * - Date-indexed: one document per day per user.
 * - Session bootstrap: agent reads today's log to understand daily context.
 *
 * Storage: Firestore `users/{userId}/captains_logs/{YYYY-MM-DD}`
 */

import { db } from '@/services/firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { logger } from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

/** Types of log entries */
export type LogEntryType =
    | 'task'        // Agent completed a task
    | 'error'       // An error occurred
    | 'heartbeat'   // System health check
    | 'decision'    // A strategic decision was made
    | 'milestone'   // An important milestone was reached
    | 'feedback'    // User provided feedback
    | 'session'     // Session start/end markers
    | 'memory';     // Memory system events (consolidation, ingestion)

/** A single entry in the Captain's Log */
export interface CaptainsLogEntry {
    /** Unique entry ID */
    id: string;
    /** ISO 8601 timestamp of when this entry was created */
    timestamp: string;
    /** Type of log entry */
    type: LogEntryType;
    /** Human-readable description of what happened */
    content: string;
    /** Which agent created this entry (optional) */
    agentId?: string;
    /** Additional structured metadata */
    metadata?: Record<string, string | number | boolean>;
}

/** The daily log document */
export interface CaptainsLogDocument {
    /** Date key in YYYY-MM-DD format */
    date: string;
    /** User ID */
    userId: string;
    /** Ordered array of log entries (append-only) */
    entries: CaptainsLogEntry[];
    /** Firestore server timestamp of last update */
    lastUpdated: Timestamp | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get today's date key in YYYY-MM-DD format.
 */
function getTodayKey(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]!;
}

/**
 * Generate a unique entry ID.
 */
function generateEntryId(type: LogEntryType): string {
    return `log_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

// ============================================================================
// CAPTAIN'S LOG SERVICE
// ============================================================================

class CaptainsLogService {
    /**
     * Get the Firestore document path for a day's log.
     */
    private getDocPath(userId: string, dateKey: string): string {
        return `users/${userId}/captains_logs/${dateKey}`;
    }

    /**
     * Append an entry to today's log.
     * Creates the daily document if it doesn't exist yet.
     */
    async appendEntry(
        userId: string,
        type: LogEntryType,
        content: string,
        options?: {
            agentId?: string;
            metadata?: Record<string, string | number | boolean>;
        }
    ): Promise<string> {
        const dateKey = getTodayKey();
        const entryId = generateEntryId(type);

        const entry: CaptainsLogEntry = {
            id: entryId,
            timestamp: new Date().toISOString(),
            type,
            content,
            agentId: options?.agentId,
            metadata: options?.metadata,
        };

        const docRef = doc(db, this.getDocPath(userId, dateKey));

        try {
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                // Append to existing document
                await updateDoc(docRef, {
                    entries: arrayUnion(entry),
                    lastUpdated: serverTimestamp(),
                });
            } else {
                // Create new daily document
                const newDoc: Omit<CaptainsLogDocument, 'lastUpdated'> = {
                    date: dateKey,
                    userId,
                    entries: [entry],
                };
                await setDoc(docRef, { ...newDoc, lastUpdated: serverTimestamp() });
            }

            logger.debug(`[CaptainsLog] 📝 ${type}: ${content.substring(0, 80)}`);
            return entryId;
        } catch (error) {
            logger.error('[CaptainsLog] Failed to append entry:', error);
            return '';
        }
    }

    /**
     * Read today's log for session bootstrap.
     * Returns all entries from today in chronological order.
     */
    async readTodaysLog(userId: string): Promise<CaptainsLogEntry[]> {
        return this.readLogByDate(userId, getTodayKey());
    }

    /**
     * Read a specific day's log.
     */
    async readLogByDate(userId: string, dateKey: string): Promise<CaptainsLogEntry[]> {
        const docRef = doc(db, this.getDocPath(userId, dateKey));

        try {
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
                return [];
            }

            const data = snap.data() as CaptainsLogDocument;
            return data.entries || [];
        } catch (error) {
            logger.warn(`[CaptainsLog] Failed to read log for ${dateKey}:`, error);
            return [];
        }
    }

    /**
     * Get a compact text summary of today's log for auto-injection.
     * Designed to fit within the Big Brain token budget.
     */
    async getTodaysSummary(userId: string): Promise<string> {
        const entries = await this.readTodaysLog(userId);
        if (entries.length === 0) {
            return '';
        }

        const lines: string[] = [`Captain's Log — ${getTodayKey()}:`];

        // Group by type for a compact view
        const tasks = entries.filter(e => e.type === 'task');
        const errors = entries.filter(e => e.type === 'error');
        const decisions = entries.filter(e => e.type === 'decision');
        const milestones = entries.filter(e => e.type === 'milestone');

        if (tasks.length > 0) {
            lines.push(`  Tasks (${tasks.length}): ${tasks.slice(-3).map(t => t.content.substring(0, 50)).join(' | ')}`);
        }
        if (errors.length > 0) {
            lines.push(`  Errors (${errors.length}): ${errors.slice(-2).map(e => e.content.substring(0, 50)).join(' | ')}`);
        }
        if (decisions.length > 0) {
            lines.push(`  Decisions: ${decisions.slice(-2).map(d => d.content.substring(0, 50)).join(' | ')}`);
        }
        if (milestones.length > 0) {
            lines.push(`  Milestones: ${milestones.map(m => m.content.substring(0, 50)).join(' | ')}`);
        }

        return lines.join('\n');
    }

    // ========================================================================
    // CONVENIENCE LOGGERS — Called by other services
    // ========================================================================

    /** Log a task completion */
    async logTask(userId: string, description: string, agentId?: string): Promise<void> {
        await this.appendEntry(userId, 'task', description, { agentId });
    }

    /** Log an error */
    async logError(userId: string, description: string, agentId?: string, errorCode?: string): Promise<void> {
        await this.appendEntry(userId, 'error', description, {
            agentId,
            metadata: errorCode ? { errorCode } : undefined,
        });
    }

    /** Log a strategic decision */
    async logDecision(userId: string, description: string, agentId?: string): Promise<void> {
        await this.appendEntry(userId, 'decision', description, { agentId });
    }

    /** Log a milestone */
    async logMilestone(userId: string, description: string): Promise<void> {
        await this.appendEntry(userId, 'milestone', description);
    }

    /** Log a session start */
    async logSessionStart(userId: string): Promise<void> {
        await this.appendEntry(userId, 'session', 'Session started', {
            metadata: { event: 'start' },
        });
    }

    /** Log a session end */
    async logSessionEnd(userId: string): Promise<void> {
        await this.appendEntry(userId, 'session', 'Session ended', {
            metadata: { event: 'end' },
        });
    }

    /** Log a memory system event */
    async logMemoryEvent(userId: string, description: string): Promise<void> {
        await this.appendEntry(userId, 'memory', description);
    }
}

export const captainsLogService = new CaptainsLogService();
