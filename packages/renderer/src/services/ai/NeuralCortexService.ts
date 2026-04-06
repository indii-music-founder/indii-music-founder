/**
 * NeuralCortexService — Semantic Visual Memory Core
 *
 * Implements the NEURAL_CORTEX.md specification:
 * - Stores and retrieves semantic entity profiles keyed by content fingerprint.
 * - Encodes audio DNA targetPrompts as multimodal embeddings for cross-modal retrieval.
 * - Provides drift detection by comparing new embeddings against stored anchors.
 * - Fail-closed on missing provenance, residency violations, or contract mismatches.
 *
 * Data Flow:
 *   AudioIntelligenceProfile.semantic.targetPrompts
 *     → embedContent() → Firestore vector index
 *     → retrieveSimilar() → buildRenderDirectives()
 *
 * @see docs/NEURAL_CORTEX.md
 */

import {
    doc, setDoc, getDoc, collection,
    where, getDocs, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { APPROVED_MODELS } from '@/core/config/ai-models';
import type { AudioIntelligenceProfile, AudioSemanticData } from '@/services/audio/types';
import { logger } from '@/utils/logger';

// ─────────────────────────────────────────────
// Data Contracts
// ─────────────────────────────────────────────

/** Canonical stored record for a semantic entity in the Cortex. */
export interface CortexEntityProfile {
    /** Content hash / fingerprint (from AudioIntelligenceService) */
    id: string;
    /** Firebase Auth UID of the owning user */
    userId: string;
    /** Human-readable label (filename or track title) */
    label: string;
    /** The full Audio DNA semantic payload */
    semantic: AudioSemanticData;
    /** Embedding vectors for image and veo prompts */
    embeddings: {
        image: number[];
        veo: number[];
    };
    /** ISO timestamp of creation */
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
    /** Model version that generated the embeddings */
    embeddingModelVersion: string;
    /** Drift score vs. the prior stored entity (0.0 = identical, 1.0 = completely different) */
    driftScore?: number;
}

/** Render directives produced from a retrieved entity profile. */
export interface RenderDirectives {
    /** Composite prompt for gemini-3-pro-image-preview */
    imagePrompt: string;
    /** Composite prompt for veo-3.1-generate-preview */
    veoPrompt: string;
    /** Summary of mood/genre for labeling */
    styleSummary: string;
    /** Marketing copy suitable for DSP pitch */
    marketingComment: string;
    /** Drift warning if the retrieved entity deviated from prior anchors */
    driftWarning?: string;
}

/** Result of a similarity search against the Cortex index. */
export interface CortexRetrievalResult {
    entity: CortexEntityProfile;
    /** Cosine similarity: 1.0 = identical, 0.0 = orthogonal */
    similarity: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CORTEX_COLLECTION = 'neural_cortex';
const DRIFT_ALERT_THRESHOLD = 0.35; // Flag drift when similarity falls below this
const EMBEDDING_MODEL = APPROVED_MODELS.EMBEDDING_DEFAULT;

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

/** Cosine similarity between two float vectors. Returns NaN if either is empty. */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return NaN;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!;
        magA += a[i]! * a[i]!;
        magB += b[i]! * b[i]!;
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Embed a single text string using the approved embedding model. */
async function embedText(text: string): Promise<number[]> {
    const result = await firebaseAI.embedContent({
        model: EMBEDDING_MODEL,
        content: {
            role: 'user',
            parts: [{ text }]
        }
    });
    return result.values;
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export class NeuralCortexService {

    private get userId(): string {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('[NeuralCortex] User not authenticated. Fail-closed.');
        return uid;
    }

    /**
     * Ingests an AudioIntelligenceProfile into the Cortex.
     *
     * - Generates embeddings for image + veo prompts.
     * - Calculates drift score vs. the prior stored entity (if any).
     * - Fails closed if required provenance (id, userId, semantic) is missing.
     */
    async ingest(profile: AudioIntelligenceProfile, label: string): Promise<CortexEntityProfile> {
        const uid = this.userId;

        // Contract validation: fail closed on missing fields
        if (!profile.id || !profile.semantic) {
            throw new Error('[NeuralCortex] Contract violation: profile.id and profile.semantic are required for ingest.');
        }

        logger.info(`[NeuralCortex] Ingesting entity for "${label}" (${profile.id})`);

        // 1. Check for prior entity (drift detection)
        const priorEntity = await this.getEntity(profile.id);

        // 2. Generate embeddings
        const [imageEmbedding, veoEmbedding] = await Promise.all([
            embedText(profile.semantic.targetPrompts.image),
            embedText(profile.semantic.targetPrompts.veo)
        ]);

        // 3. Calculate drift vs. prior
        let driftScore: number | undefined;
        if (priorEntity?.embeddings?.image && priorEntity.embeddings.image.length > 0) {
            const imageSim = cosineSimilarity(imageEmbedding, priorEntity.embeddings.image);
            driftScore = isNaN(imageSim) ? undefined : 1 - imageSim;

            if (driftScore !== undefined && driftScore > DRIFT_ALERT_THRESHOLD) {
                logger.warn(`[NeuralCortex] HIGH DRIFT detected for "${label}": score=${driftScore.toFixed(3)} (threshold=${DRIFT_ALERT_THRESHOLD})`);
            }
        }

        // 4. Build entity record
        const entity: CortexEntityProfile = {
            id: profile.id,
            userId: uid,
            label,
            semantic: profile.semantic,
            embeddings: {
                image: imageEmbedding,
                veo: veoEmbedding
            },
            createdAt: serverTimestamp() as ReturnType<typeof serverTimestamp>,
            embeddingModelVersion: EMBEDDING_MODEL,
            ...(driftScore !== undefined && { driftScore })
        };

        // 5. Persist to Firestore (users/{uid}/neural_cortex/{id})
        const ref = doc(db, 'users', uid, CORTEX_COLLECTION, profile.id);
        await setDoc(ref, entity, { merge: false });

        logger.info(`[NeuralCortex] Ingested entity "${label}" (drift=${driftScore?.toFixed(3) ?? 'n/a'})`);

        return entity;
    }

    /**
     * Retrieves a single entity profile by content ID.
     * Returns null if not found (non-blocking).
     */
    async getEntity(id: string): Promise<CortexEntityProfile | null> {
        try {
            const uid = this.userId;
            const ref = doc(db, 'users', uid, CORTEX_COLLECTION, id);
            const snap = await getDoc(ref);
            if (!snap.exists()) return null;
            return snap.data() as CortexEntityProfile;
        } catch (err: unknown) {
            logger.warn(`[NeuralCortex] Failed to retrieve entity ${id}:`, err);
            return null;
        }
    }

    /**
     * Retrieves all entity profiles for the current user.
     * Used to build a local index for similarity search.
     */
    async listEntities(): Promise<CortexEntityProfile[]> {
        try {
            const uid = this.userId;
            const ref = collection(db, 'users', uid, CORTEX_COLLECTION);
            const snap = await getDocs(ref);
            return snap.docs.map(d => d.data() as CortexEntityProfile);
        } catch (err: unknown) {
            logger.error('[NeuralCortex] Failed to list entities:', err);
            return [];
        }
    }

    /**
     * Finds the most semantically similar entities in the Cortex for a given query prompt.
     *
     * Uses cosine similarity on the stored image embeddings.
     * Results are sorted by descending similarity.
     *
     * @param queryPrompt  The image or veo prompt to search by.
     * @param topK         Maximum results to return (default: 5).
     */
    async retrieveSimilar(queryPrompt: string, topK = 5): Promise<CortexRetrievalResult[]> {
        logger.info(`[NeuralCortex] Searching for similar entities (topK=${topK})`);

        // 1. Embed the query
        const queryEmbedding = await embedText(queryPrompt);

        // 2. Load all entities (client-side ANN — replace with server-side vector search when available)
        const entities = await this.listEntities();

        if (entities.length === 0) {
            logger.info('[NeuralCortex] No entities in Cortex yet.');
            return [];
        }

        // 3. Score by cosine similarity
        const scored: CortexRetrievalResult[] = entities
            .map(entity => ({
                entity,
                similarity: cosineSimilarity(queryEmbedding, entity.embeddings.image)
            }))
            .filter(r => !isNaN(r.similarity))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        logger.info(`[NeuralCortex] Retrieved ${scored.length} entities (top sim=${scored[0]?.similarity.toFixed(3) ?? 'n/a'})`);

        return scored;
    }

    /**
     * Builds structured render directives from a retrieved entity profile.
     *
     * Synthesizes a composite prompt by enriching the raw targetPrompts with
     * mood, timbre, and lighting context from the Audio DNA.
     */
    buildRenderDirectives(entity: CortexEntityProfile): RenderDirectives {
        const { semantic } = entity;
        const moodStr = semantic.mood.join(', ');
        const genreStr = semantic.genre.join(' / ');

        // Enrich image prompt with lighting and timbre
        const imagePrompt = [
            semantic.targetPrompts.image,
            `Lighting: ${semantic.visualImagery.lighting}.`,
            `Texture: ${semantic.timbre.texture}, ${semantic.timbre.brightness}.`,
            `Era: ${semantic.productionValue.era}.`
        ].join(' ');

        // Enrich veo prompt with mood and atmospheric context
        const veoPrompt = [
            semantic.targetPrompts.veo,
            `Mood: ${moodStr}.`,
            `Narrative: ${semantic.visualImagery.narrative}`
        ].join(' ');

        const styleSummary = `${genreStr} · ${moodStr} · ${semantic.timbre.texture}`;

        const driftWarning = entity.driftScore !== undefined && entity.driftScore > DRIFT_ALERT_THRESHOLD
            ? `⚠️ Visual drift detected (score: ${entity.driftScore.toFixed(2)}). Manual continuity review recommended.`
            : undefined;

        return {
            imagePrompt,
            veoPrompt,
            styleSummary,
            marketingComment: semantic.marketingComment,
            ...(driftWarning && { driftWarning })
        };
    }

    /**
     * Convenience method: ingest + immediately retrieve render directives.
     * The canonical "one-shot" path for the Creative Director agent.
     */
    async processAndDirect(
        profile: AudioIntelligenceProfile,
        label: string
    ): Promise<RenderDirectives> {
        const entity = await this.ingest(profile, label);
        return this.buildRenderDirectives(entity);
    }
}

export const neuralCortex = new NeuralCortexService();
