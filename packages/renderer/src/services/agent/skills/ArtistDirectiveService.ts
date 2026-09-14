/**
 * packages/renderer/src/services/agent/skills/ArtistDirectiveService.ts
 *
 * Tier 0 Artist Master Directive (Living User Skill Protocol) Service.
 *
 * Provides bidirectional persistence, real-time synchronization, and prompt
 * formatting for the living user playbook. Both the human artist (via Studio UI)
 * and autonomous AI agents (via Conductor reflection tools) can inspect and refine
 * these supreme instructions.
 *
 * Stored at: users/{uid}/skills/artist_master_directive
 */

import { doc, getDoc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import {
    ArtistMasterDirectiveSchema,
    DEFAULT_ARTIST_MASTER_DIRECTIVE,
    compileDirectiveToMarkdown,
    type ArtistMasterDirective,
    type DirectiveSectionKey,
} from '@indii/shared';

function getUserId(): string | null {
    return getRealAuthenticatedUserId(auth.currentUser);
}

function getDirectiveDocRef(uid: string) {
    return doc(db, 'users', uid, 'skills', 'artist_master_directive');
}

type StoredRecord = Record<string, unknown>;

/**
 * Normalizes Firestore storage representations (e.g. Timestamp objects)
 * into ISO strings to align with the shared Zod schema.
 */
function normalizeStoredDirective(data: unknown): unknown {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

    const record = data as StoredRecord;
    const storedUpdatedAt = record.updatedAt;
    if (typeof storedUpdatedAt === 'string' || storedUpdatedAt === undefined) return record;
    if (storedUpdatedAt === null) {
        const { updatedAt: _ignored, ...withoutPending } = record;
        return withoutPending;
    }

    if (typeof storedUpdatedAt === 'object') {
        const timestamp = storedUpdatedAt as {
            toDate?: () => Date;
            toMillis?: () => number;
            seconds?: number;
        };
        const date = typeof timestamp.toDate === 'function'
            ? timestamp.toDate()
            : typeof timestamp.toMillis === 'function'
                ? new Date(timestamp.toMillis())
                : typeof timestamp.seconds === 'number'
                    ? new Date(timestamp.seconds * 1000)
                    : null;

        if (date && !Number.isNaN(date.getTime())) {
            return { ...record, updatedAt: date.toISOString() };
        }
    }

    return record;
}

export class ArtistDirectiveService {
    private cachedDirective: ArtistMasterDirective | null = null;
    private cachedUid: string | null = null;

    /**
     * Retrieves the living Artist Master Directive for the user.
     * Fail-closed: returns DEFAULT_ARTIST_MASTER_DIRECTIVE if unauthenticated,
     * in E2E mock mode, or if the document does not yet exist.
     */
    async getDirective(explicitUid?: string): Promise<ArtistMasterDirective> {
        if (isFirebaseE2EMockEnabled()) {
            return this.cachedDirective || DEFAULT_ARTIST_MASTER_DIRECTIVE;
        }

        const uid = explicitUid || getUserId();
        if (!uid) {
            return DEFAULT_ARTIST_MASTER_DIRECTIVE;
        }

        if (this.cachedDirective && this.cachedUid === uid) {
            return this.cachedDirective;
        }

        try {
            const snap = await getDoc(getDirectiveDocRef(uid));
            if (!snap.exists()) {
                this.cachedDirective = DEFAULT_ARTIST_MASTER_DIRECTIVE;
                this.cachedUid = uid;
                return DEFAULT_ARTIST_MASTER_DIRECTIVE;
            }

            const rawData = normalizeStoredDirective(snap.data());
            const parsed = ArtistMasterDirectiveSchema.safeParse(rawData);
            if (!parsed.success) {
                logger.warn(
                    '[ArtistDirectiveService] Stored directive failed schema validation, falling back to defaults',
                    parsed.error
                );
                return DEFAULT_ARTIST_MASTER_DIRECTIVE;
            }

            this.cachedDirective = parsed.data;
            this.cachedUid = uid;
            return parsed.data;
        } catch (err) {
            logger.error('[ArtistDirectiveService] getDirective failed', err);
            return DEFAULT_ARTIST_MASTER_DIRECTIVE;
        }
    }

    /**
     * Persists the complete Artist Master Directive to Firestore.
     * Validates before writing.
     */
    async saveDirective(
        directive: ArtistMasterDirective,
        modifiedBy: 'user' | 'agent' = 'user',
        reason?: string,
        explicitUid?: string
    ): Promise<{ success: boolean; error?: string }> {
        const uid = explicitUid || getUserId();
        if (!uid) {
            return { success: false, error: 'User is not authenticated' };
        }

        const toSave: ArtistMasterDirective = {
            ...directive,
            lastModifiedBy: modifiedBy,
            lastModifiedReason: reason || directive.lastModifiedReason,
            updatedAt: new Date().toISOString(),
        };

        const validation = ArtistMasterDirectiveSchema.safeParse(toSave);
        if (!validation.success) {
            const issueMsg = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
            logger.error('[ArtistDirectiveService] Directive validation failed', issueMsg);
            return { success: false, error: `Invalid directive schema: ${issueMsg}` };
        }

        if (isFirebaseE2EMockEnabled()) {
            this.cachedDirective = validation.data;
            this.cachedUid = uid;
            return { success: true };
        }

        try {
            await setDoc(getDirectiveDocRef(uid), validation.data, { merge: true });
            this.cachedDirective = validation.data;
            this.cachedUid = uid;
            return { success: true };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error('[ArtistDirectiveService] Failed to persist directive', err);
            return { success: false, error: msg };
        }
    }

    /**
     * Programmatic section refiner for agents and UI actions.
     * Appends rules, removes rules, or replaces section content with audit reason.
     */
    async refineSection(
        sectionKey: DirectiveSectionKey,
        ruleOrContent: string,
        action: 'add_rule' | 'remove_rule' | 'set_content',
        reason?: string,
        modifiedBy: 'user' | 'agent' = 'agent',
        explicitUid?: string
    ): Promise<{ success: boolean; error?: string; directive?: ArtistMasterDirective }> {
        const current = await this.getDirective(explicitUid);
        const section = current.sections[sectionKey];

        if (!section) {
            return { success: false, error: `Section "${sectionKey}" not found in directive` };
        }

        const updatedSection = { ...section };
        const trimmed = ruleOrContent.trim();

        if (action === 'add_rule') {
            if (!trimmed) {
                return { success: false, error: 'Cannot add an empty rule' };
            }
            if (!updatedSection.rules.includes(trimmed)) {
                updatedSection.rules = [...updatedSection.rules, trimmed];
            }
        } else if (action === 'remove_rule') {
            updatedSection.rules = updatedSection.rules.filter(r => r !== trimmed);
        } else if (action === 'set_content') {
            updatedSection.content = trimmed;
        }

        updatedSection.updatedAt = new Date().toISOString();

        const updatedDirective: ArtistMasterDirective = {
            ...current,
            lastModifiedBy: modifiedBy,
            lastModifiedReason: reason || current.lastModifiedReason,
            updatedAt: new Date().toISOString(),
            sections: {
                ...current.sections,
                [sectionKey]: updatedSection,
            },
        };

        const saveRes = await this.saveDirective(updatedDirective, modifiedBy, reason, explicitUid);
        if (!saveRes.success) {
            return { success: false, error: saveRes.error };
        }

        return { success: true, directive: updatedDirective };
    }

    /**
     * Subscribes to real-time updates of the user's Artist Master Directive.
     */
    subscribeToDirective(
        explicitUid: string | null | undefined,
        callback: (directive: ArtistMasterDirective) => void
    ): Unsubscribe {
        const uid = explicitUid || getUserId();
        if (!uid || isFirebaseE2EMockEnabled()) {
            callback(this.cachedDirective || DEFAULT_ARTIST_MASTER_DIRECTIVE);
            return () => {};
        }

        return onSnapshot(
            getDirectiveDocRef(uid),
            snapshot => {
                if (!snapshot.exists()) {
                    callback(DEFAULT_ARTIST_MASTER_DIRECTIVE);
                    return;
                }
                const parsed = ArtistMasterDirectiveSchema.safeParse(normalizeStoredDirective(snapshot.data()));
                if (parsed.success) {
                    this.cachedDirective = parsed.data;
                    this.cachedUid = uid;
                    callback(parsed.data);
                } else {
                    logger.warn('[ArtistDirectiveService] Real-time snapshot validation failed', parsed.error);
                    callback(DEFAULT_ARTIST_MASTER_DIRECTIVE);
                }
            },
            err => {
                logger.error('[ArtistDirectiveService] onSnapshot listener error', err);
                callback(DEFAULT_ARTIST_MASTER_DIRECTIVE);
            }
        );
    }

    /**
     * Compiles the directive into high-priority prompt instructions with
     * supreme override semantics.
     */
    formatDirectiveForPrompt(directive?: ArtistMasterDirective | null): string {
        const target = directive || this.cachedDirective || DEFAULT_ARTIST_MASTER_DIRECTIVE;
        const markdown = compileDirectiveToMarkdown(target);

        return [
            '<artist_master_directive priority="SUPREME_OVERRIDE">',
            'CRITICAL INSTRUCTION FOR ALL AGENTS & ENGINES:',
            'The following Artist Master Directive represents the living, co-authored operational instructions and non-negotiable boundaries defined by this specific artist.',
            'It strictly supersedes default platform behaviors, generic suggestions, and base domain playbooks.',
            '',
            markdown,
            '</artist_master_directive>',
        ].join('\n');
    }

    /**
     * Access cached directive synchronously if loaded.
     */
    getCachedDirective(): ArtistMasterDirective | null {
        return this.cachedDirective;
    }

    /**
     * Clears in-memory cache (e.g. on logout or test teardown).
     */
    clearCache(): void {
        this.cachedDirective = null;
        this.cachedUid = null;
    }
}

export const artistDirectiveService = new ArtistDirectiveService();
