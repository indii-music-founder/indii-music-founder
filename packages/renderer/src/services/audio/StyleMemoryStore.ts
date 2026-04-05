/**
 * StyleMemoryStore — Brain Calibration Session 5: The Style Fingerprint
 *
 * The "Off-Label Style Ledger" — tracks the consistent sonic DNA of an artist
 * across multiple uploads. Answers the critical question:
 * "Does indii recognize 'a wii production' across multiple tracks?"
 *
 * Architecture:
 * - Each ingested track contributes a StyleEntry to the artist's ledger
 * - StyleEntries are averaged into a StyleDNA profile per artist
 * - On new upload, indii compares the incoming track's semantic data
 *   against the StyleDNA to detect stylistic consistency or evolution
 *
 * Persists to Firestore under: users/{uid}/styleLedger/{trackId}
 */
import { auth, db } from '@/services/firebase';
import {
    collection, addDoc, getDocs, doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';
import { Schema } from 'firebase/ai';
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';
import type { AudioSemanticData } from '@/services/audio/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StyleEntry {
    trackId: string;
    trackTitle: string;
    uploadedAt: number;
    // Distilled style markers from AudioSemanticData
    timbreTexture: string;
    productionEra: string;
    productionQuality: string;
    mixBalance: string;
    primaryGenre: string;
    subGenre: string;
    moodTags: string[];
    instruments: string[];
}

export interface StyleDNA {
    artistId: string;
    trackCount: number;
    lastUpdated: number;
    /** Dominant texture across all tracks */
    dominantTimbre: string;
    /** Most consistent production era */
    productionEra: string;
    /** Recurring instruments across 2+ tracks */
    coreInstruments: string[];
    /** Most frequent moods */
    moodSignature: string[];
    /** Consistency score — how uniform is the style? (0.0–1.0) */
    consistencyScore: number;
    /** Narrative description of the artist's sonic brand */
    brandNarrative: string;
    /** How the latest upload fits or evolves the established DNA */
    evolutionNote: string;
}

export interface StyleComparisonResult {
    /** Does the new track fit the established style? */
    isConsistent: boolean;
    /** Similarity score (0.0 = completely different, 1.0 = identical style) */
    similarityScore: number;
    /** What's the same */
    continuities: string[];
    /** What's new or different */
    evolutions: string[];
    /** Gemini's take on this track in the context of the discography */
    contextNote: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const STYLE_COMPARISON_SCHEMA: Schema = {
    type: 'OBJECT' as const,
    properties: {
        isConsistent: { type: 'BOOLEAN' },
        similarityScore: { type: 'NUMBER' },
        continuities: { type: 'ARRAY', items: { type: 'STRING' } },
        evolutions: { type: 'ARRAY', items: { type: 'STRING' } },
        contextNote: { type: 'STRING' }
    },
    required: ['isConsistent', 'similarityScore', 'continuities', 'evolutions', 'contextNote']
} as unknown as Schema;

const BRAND_NARRATIVE_SCHEMA: Schema = {
    type: 'OBJECT' as const,
    properties: {
        dominantTimbre: { type: 'STRING' },
        productionEra: { type: 'STRING' },
        coreInstruments: { type: 'ARRAY', items: { type: 'STRING' } },
        moodSignature: { type: 'ARRAY', items: { type: 'STRING' } },
        consistencyScore: { type: 'NUMBER' },
        brandNarrative: { type: 'STRING' },
        evolutionNote: { type: 'STRING' }
    },
    required: [
        'dominantTimbre', 'productionEra', 'coreInstruments',
        'moodSignature', 'consistencyScore', 'brandNarrative', 'evolutionNote'
    ]
} as unknown as Schema;

// ─── Service ──────────────────────────────────────────────────────────────────

export class StyleMemoryStore {
    private readonly COLLECTION = 'styleLedger';

    /**
     * Records a new track's style entry and updates the artist's StyleDNA.
     */
    async recordTrack(
        trackId: string,
        trackTitle: string,
        semantic: AudioSemanticData
    ): Promise<StyleEntry> {
        return withServiceError('StyleMemoryStore', 'recordTrack', async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('User not authenticated');

            const entry: StyleEntry = {
                trackId,
                trackTitle,
                uploadedAt: Date.now(),
                timbreTexture: semantic.timbre.texture,
                productionEra: semantic.productionValue.era,
                productionQuality: semantic.productionValue.quality,
                mixBalance: semantic.productionValue.mixBalance,
                primaryGenre: semantic.ddexGenre,
                subGenre: semantic.ddexSubGenre,
                moodTags: semantic.mood,
                instruments: semantic.instruments
            };

            const ledgerRef = collection(db, 'users', uid, this.COLLECTION);
            await addDoc(ledgerRef, { ...entry, _createdAt: serverTimestamp() });

            Logger.info('StyleMemoryStore', `Recorded style entry for "${trackTitle}"`);
            return entry;
        });
    }

    /**
     * Compares a new track's semantic profile against the artist's existing StyleDNA.
     * Returns a StyleComparisonResult from Gemini's analysis.
     */
    async compareToDiscography(
        newSemantic: AudioSemanticData,
        newTrackTitle: string
    ): Promise<StyleComparisonResult | null> {
        return withServiceError('StyleMemoryStore', 'compareToDiscography', async () => {
            const entries = await this.getAllEntries();
            if (entries.length === 0) {
                Logger.info('StyleMemoryStore', 'No prior entries — this is the first track in the ledger.');
                return null;
            }

            const discographySummary = this.formatDiscographySummary(entries);

            const prompt = `
You are indii's Style Recognition Engine. Your job is to analyze an artist's sonic consistency across their catalog.

=== ESTABLISHED DISCOGRAPHY (${entries.length} track${entries.length !== 1 ? 's' : ''}) ===
${discographySummary}

=== NEW TRACK: "${newTrackTitle}" ===
Timbre: ${newSemantic.timbre.texture} | ${newSemantic.timbre.brightness}
Production: ${newSemantic.productionValue.era} | ${newSemantic.productionValue.quality} | ${newSemantic.productionValue.mixBalance}
Genre: ${newSemantic.ddexGenre} / ${newSemantic.ddexSubGenre}
Mood: ${newSemantic.mood.join(', ')}
Instruments: ${newSemantic.instruments.join(', ')}

=== YOUR ANALYSIS ===

Compare the new track to the established discography:

- 'isConsistent': Does this track clearly belong to the same artist's sonic world?
- 'similarityScore': 0.0 (entirely different sound) to 1.0 (carbon copy of prior work)
- 'continuities': 2-4 specific things that are consistent with the established style
- 'evolutions': 1-3 specific ways this track represents new sonic territory (if any)
- 'contextNote': 2-3 sentences from indii's perspective — how does this track fit
  the artist's narrative? Is this growth, reinvention, or consistency?

RULES:
- Be specific. Name instruments, textures, eras. No generic observations.
- If the catalog is all over the place, say so honestly.
- An 'evolutionNote' is positive unless the deviation is jarring.
`;

            return await GenAI.generateStructuredData<StyleComparisonResult>(
                [{ text: prompt }],
                STYLE_COMPARISON_SCHEMA,
                2048,
                'You are indii\'s style recognition engine. Analyze with precision and creative intelligence.',
                AI_MODELS.TEXT.AGENT
            );
        });
    }

    /**
     * Synthesizes the full StyleDNA for the artist from their entire ledger.
     */
    async synthesizeDNA(): Promise<StyleDNA | null> {
        return withServiceError('StyleMemoryStore', 'synthesizeDNA', async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('User not authenticated');

            const entries = await this.getAllEntries();
            if (entries.length === 0) return null;

            const discographySummary = this.formatDiscographySummary(entries);

            const prompt = `
You are synthesizing the sonic identity of an independent music artist from ${entries.length} tracks.

=== FULL DISCOGRAPHY ===
${discographySummary}

Synthesize this into a StyleDNA profile:

- 'dominantTimbre': The single most recurring textural description across all tracks
- 'productionEra': The era that best captures the production style
- 'coreInstruments': Instruments that appear in 2+ tracks — the sonic core
- 'moodSignature': The 2-4 moods that define this artist's emotional range
- 'consistencyScore': How uniform is the style? (0.0 = genre-hopper, 1.0 = locked-in sound)
- 'brandNarrative': 2-3 sentences describing this artist's sonic brand as if writing press copy
- 'evolutionNote': Has the sound evolved across the catalog, or is it stable?

Be honest. Be specific. Brand narratives don't need to be flattering — they need to be accurate.
`;

            const dnaFields = await GenAI.generateStructuredData<Omit<StyleDNA, 'artistId' | 'trackCount' | 'lastUpdated'>>(
                [{ text: prompt }],
                BRAND_NARRATIVE_SCHEMA,
                2048,
                'You are a music brand strategist and A&R analyst.',
                AI_MODELS.TEXT.AGENT
            );

            const dna: StyleDNA = {
                artistId: uid,
                trackCount: entries.length,
                lastUpdated: Date.now(),
                ...dnaFields
            };

            // Persist DNA to Firestore
            const dnaRef = doc(db, 'users', uid, 'styleDNA', 'current');
            await setDoc(dnaRef, { ...dna, _updatedAt: serverTimestamp() }, { merge: true });

            Logger.info('StyleMemoryStore', `StyleDNA synthesized from ${entries.length} tracks. Consistency: ${(dna.consistencyScore * 100).toFixed(0)}%`);
            return dna;
        });
    }

    private async getAllEntries(): Promise<StyleEntry[]> {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];

        const ledgerRef = collection(db, 'users', uid, this.COLLECTION);
        const snapshot = await getDocs(ledgerRef);
        return snapshot.docs.map(d => d.data() as StyleEntry);
    }

    private formatDiscographySummary(entries: StyleEntry[]): string {
        return entries.map((e, i) =>
            `Track ${i + 1}: "${e.trackTitle}" | Timbre: ${e.timbreTexture} | Era: ${e.productionEra} | ` +
            `Genre: ${e.primaryGenre}/${e.subGenre} | Mix: ${e.mixBalance} | ` +
            `Mood: ${e.moodTags.join(', ')} | Instruments: ${e.instruments.join(', ')}`
        ).join('\n');
    }
}

export const styleMemoryStore = new StyleMemoryStore();
