/**
 * CORE Vault Service — Layer 3 of the IndiiOS Memory Architecture
 *
 * The inspectable, authoritative source of truth for durable knowledge.
 * When in conflict with other memory layers, the CORE Vault ALWAYS wins.
 *
 * Philosophy:
 * - Supersede, never delete. Facts are marked 'superseded' to preserve version history.
 * - Folder-based organization: each category has a summary + items array.
 * - Atomic fact schema per entry.
 *
 * Storage: Firestore `users/{userId}/vault/{category}`
 */

import { db } from '@/services/firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { GenAI as AI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';

// ============================================================================
// TYPES
// ============================================================================

/** Valid categories for CORE Vault entries */
export type VaultCategory =
    | 'artist_identity'   // Name, brand, genre, aesthetic
    | 'business_model'    // Revenue streams, pricing, splits
    | 'team'              // Collaborators, managers, engineers
    | 'distribution'      // Distributors, territories, deal terms
    | 'legal'             // Contracts, rights, registrations
    | 'financial'         // Bank info, tax status, revenue targets
    | 'technical'         // DAW, plugins, hardware, studio specs
    | 'preferences'       // Communication style, workflow habits
    | 'goals'             // Short-term and long-term objectives
    | 'contacts';         // Industry contacts, A&R, publishers

/** Status lifecycle: active → superseded (never deleted) */
export type VaultFactStatus = 'active' | 'superseded';

/** Source of the fact */
export type VaultFactSource = 'user' | 'agent' | 'webhook' | 'import' | 'onboarding';

/** A single atomic fact in the CORE Vault */
export interface VaultFact {
    /** Unique ID within the category */
    id: string;
    /** The canonical statement of fact */
    fact: string;
    /** Category this fact belongs to */
    category: VaultCategory;
    /** ISO 8601 timestamp of when this fact was established */
    timestamp: string;
    /** How this fact entered the system */
    source: VaultFactSource;
    /** Lifecycle status — superseded facts are preserved but not active */
    status: VaultFactStatus;
    /** Number of times this fact has been accessed by agents */
    accessCount: number;
    /** If superseded, the ID of the replacement fact */
    supersededBy?: string;
    /** If this fact superseded another, the ID of the old fact */
    supersedes?: string;
    /** Optional tags for filtering */
    tags?: string[];
}

/** A single vault document stored per category */
export interface VaultDocument {
    /** Category identifier */
    category: VaultCategory;
    /** Human-readable summary of all active facts in this category */
    summary: string;
    /** The atomic facts array */
    items: VaultFact[];
    /** Last time this vault category was updated */
    lastUpdated: Timestamp | null;
    /** Last time the summary was regenerated */
    lastSummaryGenerated: Timestamp | null;
}

// ============================================================================
// ALL VAULT CATEGORIES
// ============================================================================

export const ALL_VAULT_CATEGORIES: VaultCategory[] = [
    'artist_identity',
    'business_model',
    'team',
    'distribution',
    'legal',
    'financial',
    'technical',
    'preferences',
    'goals',
    'contacts',
];

// ============================================================================
// CORE VAULT SERVICE
// ============================================================================

class CoreVaultService {
    /**
     * Get the Firestore document path for a vault category.
     */
    private getDocPath(userId: string, category: VaultCategory): string {
        return `users/${userId}/vault/${category}`;
    }

    /**
     * Get a vault document, creating it if it doesn't exist.
     */
    private async getOrCreateDocument(userId: string, category: VaultCategory): Promise<VaultDocument> {
        const docRef = doc(db, this.getDocPath(userId, category));

        try {
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                return snap.data() as VaultDocument;
            }
        } catch (error: unknown) {
            logger.warn(`[CoreVault] Failed to fetch vault/${category}:`, error);
        }

        // Create empty document
        const newDoc: VaultDocument = {
            category,
            summary: '',
            items: [],
            lastUpdated: null,
            lastSummaryGenerated: null,
        };

        try {
            await setDoc(docRef, { ...newDoc, lastUpdated: serverTimestamp() });
        } catch (error: unknown) {
            logger.error(`[CoreVault] Failed to create vault/${category}:`, error);
        }

        return newDoc;
    }

    /**
     * Read all active facts from a vault category.
     */
    async readVault(userId: string, category: VaultCategory): Promise<{ summary: string; facts: VaultFact[] }> {
        const vaultDoc = await this.getOrCreateDocument(userId, category);
        const activeFacts = vaultDoc.items.filter(item => item.status === 'active');

        // Increment access counts
        const updatedItems = vaultDoc.items.map(item => {
            if (item.status === 'active') {
                return { ...item, accessCount: item.accessCount + 1 };
            }
            return item;
        });

        // Write updated access counts back
        try {
            const docRef = doc(db, this.getDocPath(userId, category));
            await updateDoc(docRef, { items: updatedItems });
        } catch (error: unknown) {
            logger.warn('[CoreVault] Failed to update access counts (non-blocking):', error);
        }

        return {
            summary: vaultDoc.summary,
            facts: activeFacts,
        };
    }

    /**
     * Read active facts across ALL vault categories.
     * Returns a map of category → active facts.
     */
    async readAllVaults(userId: string): Promise<Record<VaultCategory, VaultFact[]>> {
        const result = {} as Record<VaultCategory, VaultFact[]>;

        const reads = ALL_VAULT_CATEGORIES.map(async (category) => {
            const { facts } = await this.readVault(userId, category);
            result[category] = facts;
        });

        await Promise.allSettled(reads);
        return result;
    }

    /**
     * Add a new atomic fact to a vault category.
     * Returns the generated fact ID.
     */
    async addFact(
        userId: string,
        category: VaultCategory,
        factText: string,
        source: VaultFactSource = 'user',
        options?: { tags?: string[]; supersedes?: string }
    ): Promise<string> {
        const vaultDoc = await this.getOrCreateDocument(userId, category);

        // Check for exact duplicates among active facts
        const isDuplicate = vaultDoc.items.some(
            item => item.status === 'active' && item.fact.toLowerCase() === factText.toLowerCase()
        );
        if (isDuplicate) {
            logger.debug(`[CoreVault] Duplicate fact skipped in ${category}: "${factText.substring(0, 50)}..."`);
            const existing = vaultDoc.items.find(
                item => item.status === 'active' && item.fact.toLowerCase() === factText.toLowerCase()
            );
            return existing?.id || '';
        }

        const factId = `vault_${category}_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

        const newFact: VaultFact = {
            id: factId,
            fact: factText,
            category,
            timestamp: new Date().toISOString(),
            source,
            status: 'active',
            accessCount: 0,
            supersedes: options?.supersedes,
            tags: options?.tags || [],
        };

        // If this supersedes an old fact, mark the old one
        const updatedItems = [...vaultDoc.items];
        if (options?.supersedes) {
            const oldIdx = updatedItems.findIndex(item => item.id === options.supersedes);
            if (oldIdx !== -1) {
                updatedItems[oldIdx] = {
                    ...updatedItems[oldIdx]!,
                    status: 'superseded',
                    supersededBy: factId,
                };
                logger.info(`[CoreVault] Superseded fact ${options.supersedes} with ${factId}`);
            }
        }

        updatedItems.push(newFact);

        // Write back
        const docRef = doc(db, this.getDocPath(userId, category));
        try {
            await updateDoc(docRef, {
                items: updatedItems,
                lastUpdated: serverTimestamp(),
            });
        } catch (error: unknown) {
            // Document might not exist yet (race condition with getOrCreateDocument)
            await setDoc(docRef, {
                category,
                summary: vaultDoc.summary,
                items: updatedItems,
                lastUpdated: serverTimestamp(),
                lastSummaryGenerated: vaultDoc.lastSummaryGenerated,
            });
        }

        logger.info(`[CoreVault] Added fact ${factId} to ${category}: "${factText.substring(0, 60)}..."`);
        return factId;
    }

    /**
     * Supersede an existing fact with a new one.
     * The old fact is marked 'superseded' and linked to the new fact.
     * The old fact is NEVER deleted.
     */
    async supersedeFact(
        userId: string,
        category: VaultCategory,
        oldFactId: string,
        newFactText: string,
        source: VaultFactSource = 'user'
    ): Promise<string> {
        return this.addFact(userId, category, newFactText, source, { supersedes: oldFactId });
    }

    /**
     * Get the version history of a fact (its supersession chain).
     */
    async getFactHistory(userId: string, category: VaultCategory, factId: string): Promise<VaultFact[]> {
        const vaultDoc = await this.getOrCreateDocument(userId, category);
        const chain: VaultFact[] = [];

        // Walk backwards through supersession chain
        let currentId: string | undefined = factId;
        while (currentId) {
            const fact = vaultDoc.items.find(item => item.id === currentId);
            if (!fact) break;
            chain.push(fact);
            currentId = fact.supersedes;
        }

        return chain;
    }

    /**
     * Regenerate the summary for a vault category.
     * Uses Gemini to create a concise natural language summary of all active facts.
     */
    async regenerateSummary(userId: string, category: VaultCategory): Promise<string> {
        const vaultDoc = await this.getOrCreateDocument(userId, category);
        const activeFacts = vaultDoc.items.filter(item => item.status === 'active');

        if (activeFacts.length === 0) {
            return '';
        }

        const factsText = activeFacts.map((f, i) => `${i + 1}. ${f.fact}`).join('\n');

        const prompt = `
You are writing a concise summary for a knowledge vault category: "${category}".

ACTIVE FACTS:
${factsText}

OUTPUT:
Write a 2-4 sentence summary capturing the key information from these facts.
Be specific and actionable. This summary is used by AI agents to quickly understand this category.
        `.trim();

        let summary = '';
        try {
            const result = await AI.generateContent(
                [{ role: 'user', parts: [{ text: prompt }] }],
                AI_MODELS.TEXT.FAST
            );
            summary = result.response.text() || '';
        } catch (error: unknown) {
            logger.error(`[CoreVault] Failed to generate summary for ${category}:`, error);
            summary = `${activeFacts.length} active facts in ${category}.`;
        }

        // Persist the summary
        const docRef = doc(db, this.getDocPath(userId, category));
        try {
            await updateDoc(docRef, {
                summary,
                lastSummaryGenerated: serverTimestamp(),
            });
        } catch (error: unknown) {
            logger.warn('[CoreVault] Failed to persist summary (non-blocking):', error);
        }

        return summary;
    }

    /**
     * Get a compact index of all vault categories for the agent routing map.
     * Returns category names with fact counts — stays under 500 tokens.
     */
    async getVaultIndex(userId: string): Promise<string> {
        const lines: string[] = ['CORE Vault Index:'];

        for (const category of ALL_VAULT_CATEGORIES) {
            try {
                const vaultDoc = await this.getOrCreateDocument(userId, category);
                const activeCount = vaultDoc.items.filter(i => i.status === 'active').length;
                if (activeCount > 0) {
                    lines.push(`  ${category}: ${activeCount} facts`);
                }
            } catch {
                // Skip categories that fail
            }
        }

        return lines.join('\n');
    }
}

export const coreVaultService = new CoreVaultService();
