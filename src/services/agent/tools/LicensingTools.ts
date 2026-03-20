import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '@/utils/logger';

const SyncMatchSchema = z.object({
    matches: z.array(z.object({
        title: z.string(),
        artist: z.string(),
        bpm: z.number(),
        mood: z.string(),
        confidence: z.number(),
        matchReason: z.string()
    }))
});

export const LicensingTools = {
    match_sync_licensing_brief: wrapTool('match_sync_licensing_brief', async (args: { briefDescription: string; mood: string; targetBpm: number }) => {
        // Item 133: Use Gemini to intelligently match catalog tracks to sync briefs
        const { trackLibrary } = await import('@/services/metadata/TrackLibraryService');

        // 1. Load catalog from TrackLibraryService
        let catalogTracks: Array<{ title: string; artist: string; bpm?: number; genre?: string; mood?: string }> = [];
        try {
            const tracks = await trackLibrary.list();
            catalogTracks = tracks.map((t: any) => ({
                title: t.trackTitle || 'Untitled',
                artist: t.artistName || 'Unknown',
                bpm: t.bpm,
                genre: t.genre,
                mood: t.mood
            }));
        } catch (e) {
            logger.warn('[LicensingTools] Could not load catalog, using AI-only matching:', e);
        }

        // 2. Use Gemini to analyze the brief and match against catalog
        const schema = zodToJsonSchema(SyncMatchSchema);
        const prompt = `
        You are a Music Supervisor assistant. A sync licensing brief has been received.
        
        Brief Description: ${args.briefDescription}
        Target Mood: ${args.mood}
        Target BPM: ${args.targetBpm}
        
        Available Catalog (${catalogTracks.length} tracks):
        ${catalogTracks.length > 0
                ? catalogTracks.map(t => `- "${t.title}" by ${t.artist} | BPM: ${t.bpm || 'unknown'} | Mood: ${t.mood || 'unknown'} | Genre: ${t.genre || 'unknown'}`).join('\n')
                : 'No catalog loaded — generate 3 example suggestions based on the brief criteria.'
            }
        
        Return the top matches (up to 5), scored by confidence (0.0–1.0).
        For each match, explain WHY it fits the brief.
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = SyncMatchSchema.parse(data);

        return toolSuccess({
            briefDescription: args.briefDescription,
            targetMood: args.mood,
            targetBpm: args.targetBpm,
            matchedTracks: validated.matches,
            totalMatches: validated.matches.length,
            catalogSize: catalogTracks.length
        }, `Parsed licensing brief. Found ${validated.matches.length} catalog tracks fitting the mood (${args.mood}) and BPM (${args.targetBpm}).`);
    }),

    generate_beat_lease_contract: wrapTool('generate_beat_lease_contract', async (args: { beatTitle: string; producerName: string; buyerName: string; leaseType: 'Exclusive' | 'Non-Exclusive'; price: number }) => {
        // Item 134: Delegate to LegalTools.draft_contract for real contract generation
        const { LegalTools } = await import('./LegalTools');

        const terms = [
            `Beat Title: ${args.beatTitle}`,
            `Lease Type: ${args.leaseType}`,
            `License Fee: $${args.price}`,
            args.leaseType === 'Non-Exclusive'
                ? 'Rights: Non-exclusive license for commercial distribution. Producer retains ownership. Lessee may distribute up to 5,000 units/streams without additional payment.'
                : 'Rights: Exclusive license. Full ownership transfer upon payment. Producer waives all future rights to license this beat to others.',
            `Effective Date: ${new Date().toISOString().split('T')[0]}`
        ].join('\n');

        const result = await LegalTools.draft_contract!({
            type: `${args.leaseType} Beat Lease Agreement`,
            parties: [args.producerName, args.buyerName],
            terms
        });

        const contractId = result?.data?.contractId || `lease_${Date.now()}`;

        return toolSuccess({
            beatTitle: args.beatTitle,
            leaseType: args.leaseType,
            buyer: args.buyerName,
            producer: args.producerName,
            price: args.price,
            contractId,
            status: 'Draft Generated',
            content: result?.data?.content
        }, `${args.leaseType} beat-leasing contract generated for "${args.beatTitle}" priced at $${args.price}. Contract ID: ${contractId}`);
    })
} satisfies Record<string, AnyToolFunction>;

export const {
    match_sync_licensing_brief,
    generate_beat_lease_contract
} = LicensingTools;