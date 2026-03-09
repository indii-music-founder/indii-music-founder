/**
 * Career Memory Archival Service
 *
 * Extends the existing Memory Agent by providing long-term vector
 * archival of career milestones, decisions, and events. This enables
 * the AI agents to recall historical context when advising the artist.
 *
 * Unlike the real-time Memory Agent (which handles immediate context),
 * this service manages the "deep memory" — permanent career records
 * that persist across sessions and inform strategic decisions.
 *
 * Storage: Firestore `career_memory_archive` collection
 * Retrieval: Semantic similarity search via embeddings
 */

import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

/** A single career memory entry */
export interface CareerMemory {
    /** Firestore document ID */
    id: string;

    /** Human-readable summary of the event/decision */
    content: string;

    /** Category for filtering */
    category: CareerMemoryCategory;

    /** Importance: 1 (routine) to 10 (career-defining) */
    importance: number;

    /** ISO 8601 date of when this event occurred (not when it was recorded) */
    eventDate: string;

    /** Tags for quick lookup */
    tags: string[];

    /** Related entity IDs (release IDs, contract IDs, etc.) */
    relatedEntities: string[];

    /** Vector embedding for semantic search (768-dim from Gemini) */
    embedding?: number[];

    /** Source: how this memory was created */
    source: 'manual' | 'agent' | 'webhook' | 'import';

    /** Ownership */
    userId: string;

    /** Timestamps */
    createdAt: Timestamp | null;
    archivedAt?: Timestamp | null;
}

export type CareerMemoryCategory =
    | 'release'           // Album/single/EP release events
    | 'contract'          // Contract signing, negotiation outcomes
    | 'financial'         // Revenue milestones, payment events
    | 'collaboration'     // Feature agreements, co-writing sessions
    | 'legal'             // Copyright registrations, disputes
    | 'marketing'         // Campaign launches, viral moments
    | 'performance'       // Shows, tours, festival bookings
    | 'milestone'         // Streaming milestones, chart positions
    | 'decision'          // Strategic decisions (label choice, territory expansion)
    | 'relationship';     // Industry contacts, A&R meetings

const ARCHIVE_COLLECTION = 'career_memory_archive';

export class CareerMemoryArchiveService {
    /**
     * Record a new career memory.
     *
     * @param memory - Memory data (without id, userId, timestamps)
     * @returns The created memory with its Firestore ID
     */
    static async record(memory: Omit<CareerMemory, 'id' | 'userId' | 'createdAt' | 'archivedAt'>): Promise<CareerMemory> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const docRef = doc(collection(db, ARCHIVE_COLLECTION));
        const entry: CareerMemory = {
            ...memory,
            id: docRef.id,
            userId: user.uid,
            createdAt: null,
        };

        await setDoc(docRef, {
            ...entry,
            createdAt: serverTimestamp(),
        });

        return entry;
    }

    /**
     * Record a career event from a webhook or automated source.
     * Convenience wrapper that sets source = 'webhook'.
     */
    static async recordFromWebhook(params: {
        content: string;
        category: CareerMemoryCategory;
        importance: number;
        tags?: string[];
        relatedEntities?: string[];
    }): Promise<CareerMemory> {
        return CareerMemoryArchiveService.record({
            content: params.content,
            category: params.category,
            importance: params.importance,
            eventDate: new Date().toISOString(),
            tags: params.tags || [],
            relatedEntities: params.relatedEntities || [],
            source: 'webhook',
        });
    }

    /**
     * Retrieve memories by category.
     */
    static async getByCategory(category: CareerMemoryCategory, maxResults = 20): Promise<CareerMemory[]> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const q = query(
            collection(db, ARCHIVE_COLLECTION),
            where('userId', '==', user.uid),
            where('category', '==', category),
            orderBy('eventDate', 'desc'),
            limit(maxResults),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as CareerMemory);
    }

    /**
     * Retrieve the most important career memories.
     * Used by the annual review agent to generate year-in-review reports.
     */
    static async getTopMilestones(year: number, maxResults = 10): Promise<CareerMemory[]> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        const q = query(
            collection(db, ARCHIVE_COLLECTION),
            where('userId', '==', user.uid),
            where('eventDate', '>=', yearStart),
            where('eventDate', '<=', yearEnd),
            orderBy('eventDate', 'desc'),
            limit(maxResults * 3), // Over-fetch to sort by importance client-side
        );
        const snap = await getDocs(q);
        const memories = snap.docs.map(d => d.data() as CareerMemory);

        // Sort by importance descending, take top N
        return memories
            .sort((a, b) => b.importance - a.importance)
            .slice(0, maxResults);
    }

    /**
     * Retrieve all memories related to a specific entity (release, contract, etc.)
     */
    static async getByEntity(entityId: string): Promise<CareerMemory[]> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const q = query(
            collection(db, ARCHIVE_COLLECTION),
            where('userId', '==', user.uid),
            where('relatedEntities', 'array-contains', entityId),
            orderBy('eventDate', 'desc'),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as CareerMemory);
    }

    /**
     * Search memories by tags.
     */
    static async searchByTag(tag: string, maxResults = 20): Promise<CareerMemory[]> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const q = query(
            collection(db, ARCHIVE_COLLECTION),
            where('userId', '==', user.uid),
            where('tags', 'array-contains', tag),
            orderBy('eventDate', 'desc'),
            limit(maxResults),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as CareerMemory);
    }

    /**
     * Generate a year-in-review summary structure.
     * Returns categorized memories for the annual review agent to process.
     */
    static async generateYearInReviewData(year: number): Promise<Record<CareerMemoryCategory, CareerMemory[]>> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        const q = query(
            collection(db, ARCHIVE_COLLECTION),
            where('userId', '==', user.uid),
            where('eventDate', '>=', yearStart),
            where('eventDate', '<=', yearEnd),
            orderBy('eventDate', 'desc'),
        );
        const snap = await getDocs(q);
        const allMemories = snap.docs.map(d => d.data() as CareerMemory);

        // Group by category
        const grouped: Record<string, CareerMemory[]> = {};
        for (const memory of allMemories) {
            if (!grouped[memory.category]) {
                grouped[memory.category] = [];
            }
            grouped[memory.category].push(memory);
        }

        return grouped as Record<CareerMemoryCategory, CareerMemory[]>;
    }
}
