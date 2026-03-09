/**
 * M5 Local-First AI Toggle Service
 *
 * Manages the user's preference for running AI inference locally
 * vs. in the cloud. When local-first mode is enabled, compatible
 * tasks (text generation, embeddings, classification) route to
 * local models via Ollama instead of Gemini API.
 *
 * This gives artists:
 * - Privacy: Data never leaves their machine
 * - Cost savings: No API token usage for routine tasks
 * - Offline capability: Works without internet
 *
 * The toggle is stored per-user in Firestore and respected by
 * all AI service layers.
 *
 * Incompatible tasks (image gen, video gen, TTS) always use cloud.
 */

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

/** AI capability categories and their local-first compatibility */
export interface AICapabilityConfig {
    /** Text generation (prompts, summaries, copywriting) */
    textGeneration: AIRoutingMode;

    /** Embeddings for semantic search */
    embeddings: AIRoutingMode;

    /** Text classification (sentiment, genre, mood) */
    classification: AIRoutingMode;

    /** Code generation / analysis */
    codeGeneration: AIRoutingMode;

    /** Image generation — cloud-only (Gemini 3 Pro Image) */
    imageGeneration: 'cloud';

    /** Video generation — cloud-only (Veo 3.1) */
    videoGeneration: 'cloud';

    /** Text-to-Speech — cloud-only (Gemini 2.5 Pro TTS) */
    tts: 'cloud';
}

export type AIRoutingMode = 'cloud' | 'local' | 'auto';

/** Full M5 preferences record */
export interface M5Preferences {
    /** Master toggle: local-first mode */
    localFirstEnabled: boolean;

    /** Per-capability routing */
    capabilities: AICapabilityConfig;

    /** Ollama endpoint (default: http://localhost:11434) */
    ollamaEndpoint: string;

    /** Preferred local model for text tasks */
    localTextModel: string;

    /** Preferred local model for embeddings */
    localEmbeddingModel: string;

    /** Fallback to cloud if local model fails */
    fallbackToCloud: boolean;

    /** Max token limit for local inference (prevents OOM) */
    localMaxTokens: number;

    /** Last health check of local model */
    lastHealthCheck?: string;
    localModelAvailable?: boolean;
}

const M5_COLLECTION = 'user_preferences';
const M5_DOC_KEY = 'm5_ai_config';

/** Default configuration: cloud everything */
const DEFAULT_M5: M5Preferences = {
    localFirstEnabled: false,
    capabilities: {
        textGeneration: 'cloud',
        embeddings: 'cloud',
        classification: 'cloud',
        codeGeneration: 'cloud',
        imageGeneration: 'cloud',
        videoGeneration: 'cloud',
        tts: 'cloud',
    },
    ollamaEndpoint: 'http://localhost:11434',
    localTextModel: 'gemma3:12b',
    localEmbeddingModel: 'nomic-embed-text',
    fallbackToCloud: true,
    localMaxTokens: 4096,
};

export class M5LocalFirstService {
    /**
     * Get the user's M5 AI preferences.
     * Returns defaults if not yet configured.
     */
    static async getPreferences(): Promise<M5Preferences> {
        const user = auth.currentUser;
        if (!user) return DEFAULT_M5;

        const docRef = doc(db, M5_COLLECTION, user.uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) return DEFAULT_M5;

        const data = snap.data();
        return (data[M5_DOC_KEY] as M5Preferences) || DEFAULT_M5;
    }

    /**
     * Update M5 AI preferences.
     */
    static async updatePreferences(updates: Partial<M5Preferences>): Promise<void> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const current = await M5LocalFirstService.getPreferences();
        const merged: M5Preferences = {
            ...current,
            ...updates,
            capabilities: {
                ...current.capabilities,
                ...(updates.capabilities || {}),
                // Cloud-only capabilities cannot be changed
                imageGeneration: 'cloud',
                videoGeneration: 'cloud',
                tts: 'cloud',
            },
        };

        const docRef = doc(db, M5_COLLECTION, user.uid);
        await setDoc(docRef, {
            [M5_DOC_KEY]: merged,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }

    /**
     * Enable local-first mode with sensible defaults.
     * Routes text, embeddings, and classification to local models.
     */
    static async enableLocalFirst(): Promise<void> {
        await M5LocalFirstService.updatePreferences({
            localFirstEnabled: true,
            capabilities: {
                textGeneration: 'local',
                embeddings: 'local',
                classification: 'local',
                codeGeneration: 'auto',
                imageGeneration: 'cloud',
                videoGeneration: 'cloud',
                tts: 'cloud',
            },
        });
    }

    /**
     * Disable local-first mode (cloud everything).
     */
    static async disableLocalFirst(): Promise<void> {
        await M5LocalFirstService.updatePreferences({
            localFirstEnabled: false,
            capabilities: DEFAULT_M5.capabilities,
        });
    }

    /**
     * Determine routing for a specific AI task.
     * Returns 'local' or 'cloud' based on the capability and settings.
     */
    static async resolveRouting(capability: keyof AICapabilityConfig): Promise<'local' | 'cloud'> {
        const prefs = await M5LocalFirstService.getPreferences();

        // Cloud-only capabilities
        if (capability === 'imageGeneration' || capability === 'videoGeneration' || capability === 'tts') {
            return 'cloud';
        }

        // Master toggle off → cloud
        if (!prefs.localFirstEnabled) {
            return 'cloud';
        }

        const mode = prefs.capabilities[capability];
        if (mode === 'local') return 'local';
        if (mode === 'cloud') return 'cloud';

        // 'auto' mode: check if local model is available
        if (prefs.localModelAvailable) {
            return 'local';
        }
        return prefs.fallbackToCloud ? 'cloud' : 'local';
    }

    /**
     * Check if the local Ollama server is running and responsive.
     */
    static async healthCheck(): Promise<{ available: boolean; models: string[] }> {
        const prefs = await M5LocalFirstService.getPreferences();

        try {
            const res = await fetch(`${prefs.ollamaEndpoint}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
            });

            if (!res.ok) {
                return { available: false, models: [] };
            }

            const data = await res.json();
            const models = (data.models || []).map((m: { name: string }) => m.name);

            // Persist health status
            await M5LocalFirstService.updatePreferences({
                lastHealthCheck: new Date().toISOString(),
                localModelAvailable: true,
            });

            return { available: true, models };
        } catch {
            await M5LocalFirstService.updatePreferences({
                lastHealthCheck: new Date().toISOString(),
                localModelAvailable: false,
            });
            return { available: false, models: [] };
        }
    }
}
