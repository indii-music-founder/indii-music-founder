import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import { importWithRetry } from '@/utils/dynamicImport';

/** Typed Electron IPC bridge for publicist tools */
interface ElectronPublicistBridge {
    generatePdf: (data: unknown) => Promise<{ success: boolean; path?: string }>;
}

interface ElectronWindowAPI {
    electronAPI?: {
        publicist?: ElectronPublicistBridge;
    };
}

// --- Validation Schemas ---

const WritePressReleaseSchema = z.object({
    headline: z.string(),
    dateline: z.string(),
    introduction: z.string(),
    body_paragraphs: z.array(z.string()),
    quotes: z.array(z.object({
        speaker: z.string(),
        text: z.string()
    })),
    boilerplate: z.string(),
    contact_info: z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string().optional()
    })
});

const GenerateCrisisResponseSchema = z.object({
    severity_assessment: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    strategy: z.string(),
    public_statement: z.string(),
    internal_talking_points: z.array(z.string()),
    actions_to_take: z.array(z.string())
});

const PitchStorySchema = z.object({
    subject_line: z.string(),
    hook: z.string(),
    body: z.string(),
    call_to_action: z.string(),
    angle: z.string(),
    target_outlets: z.array(z.string())
});

// --- Tools Implementation ---

export const PublicistTools = {
    write_press_release: wrapTool('write_press_release', async ({ topic, angle, quotes_from, generate_pdf = false }: { topic: string; angle?: string; quotes_from?: string[]; generate_pdf?: boolean }) => {
        const schema = zodToJsonSchema(WritePressReleaseSchema);
        const prompt = `
        You are a Senior Publicist. Write a Press Release.
        Topic: ${topic}
        ${angle ? `Angle: ${angle}` : ''}
        ${quotes_from ? `Include quotes from: ${quotes_from.join(', ')}` : ''}
        
        Provide the response in a structured format suitable for a press release.
        `;

        const data = await AutonomousIntelligence.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = WritePressReleaseSchema.parse(data);

        let pdfResult: { success: boolean; path?: string } | null = null;
        const electronWin = window as unknown as ElectronWindowAPI;
        if (generate_pdf && electronWin.electronAPI?.publicist) {
            try {
                pdfResult = await electronWin.electronAPI.publicist.generatePdf(validated);
            } catch (err: unknown) {
                logger.error('[PublicistTools] PDF generation failed:', err);
            }
        }

        // ISSUE-838: this used to always say "generated" with no saved
        // state, even when unauthenticated or the write failed. docId is
        // now only set on a real, confirmed Firestore write.
        const { auth, db } = await importWithRetry(() => import('@/services/firebase'));
        const uid = auth.currentUser?.uid;
        let docId: string | undefined;
        let saveError: string | undefined;
        if (uid) {
            try {
                const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
                const docRef = await addDoc(collection(db, 'users', uid, 'press_releases'), {
                    ...validated,
                    topic,
                    pdfPath: pdfResult?.path || null,
                    createdAt: serverTimestamp()
                });
                docId = docRef.id;
            } catch (err: unknown) {
                saveError = err instanceof Error ? err.message : String(err);
                logger.warn('[PublicistTools] Failed to persist press release:', err);
            }
        } else {
            saveError = 'No user is signed in.';
        }

        const pdfNote = pdfResult?.success ? ' (PDF Created)' : '';
        return toolSuccess({
            ...validated,
            pdf: pdfResult,
            saved: Boolean(docId),
            docId
        }, docId
            ? `Press release generated: ${validated.headline}${pdfNote} and saved (ID: ${docId}).`
            : `Press release generated: ${validated.headline}${pdfNote}, but NOT saved to your Publicist Dashboard: ${saveError}`);
    }),

    generate_crisis_response: wrapTool('generate_crisis_response', async ({ situation, tone }: { situation: string; tone?: string }) => {
        const schema = zodToJsonSchema(GenerateCrisisResponseSchema);
        const prompt = `
        You are a Crisis Manager. Develop a response strategy.
        Situation: ${situation}
        Tone: ${tone || 'Professional, empathetic, and firm'}.
        `;

        const data = await AutonomousIntelligence.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = GenerateCrisisResponseSchema.parse(data);

        const { auth, db } = await importWithRetry(() => import('@/services/firebase'));
        const uid = auth.currentUser?.uid;
        let docId: string | undefined;
        let saveError: string | undefined;
        if (uid) {
            try {
                const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
                const docRef = await addDoc(collection(db, 'users', uid, 'crisis_responses'), {
                    ...validated,
                    situation,
                    createdAt: serverTimestamp()
                });
                docId = docRef.id;
            } catch (err: unknown) {
                saveError = err instanceof Error ? err.message : String(err);
                logger.warn('[PublicistTools] Failed to persist crisis response:', err);
            }
        } else {
            saveError = 'No user is signed in.';
        }

        return toolSuccess(
            { ...validated, saved: Boolean(docId), docId },
            docId
                ? `Crisis response strategy developed and saved (ID: ${docId}).`
                : `Crisis response strategy developed, but NOT saved: ${saveError}`
        );
    }),

    pitch_story: wrapTool('pitch_story', async ({ story_summary, recipient_type }: { story_summary: string; recipient_type?: string }) => {
        const schema = zodToJsonSchema(PitchStorySchema);
        const prompt = `
        You are a PR Specialist. Write an email pitch.
        Story: ${story_summary}
        Recipient: ${recipient_type || 'General Media'}.
        `;

        const data = await AutonomousIntelligence.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = PitchStorySchema.parse(data);

        const { auth, db } = await importWithRetry(() => import('@/services/firebase'));
        const uid = auth.currentUser?.uid;
        let docId: string | undefined;
        let saveError: string | undefined;
        if (uid) {
            try {
                const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
                const docRef = await addDoc(collection(db, 'users', uid, 'email_pitches'), {
                    ...validated,
                    story_summary,
                    recipient_type,
                    createdAt: serverTimestamp()
                });
                docId = docRef.id;
            } catch (err: unknown) {
                saveError = err instanceof Error ? err.message : String(err);
                logger.warn('[PublicistTools] Failed to persist email pitch:', err);
            }
        } else {
            saveError = 'No user is signed in.';
        }

        return toolSuccess(
            { ...validated, saved: Boolean(docId), docId },
            docId
                ? `Email pitch created and saved: ${validated.subject_line} (ID: ${docId}).`
                : `Email pitch created for "${validated.subject_line}", but NOT saved: ${saveError}`
        );
    }),

    draft_pitch_email: wrapTool('draft_pitch_email', async (args: { playlistName: string; genre: string; trackTitle: string }) => {
        const schema = zodToJsonSchema(PitchStorySchema);
        const prompt = `
        You are a PR Specialist. Scrape info for Spotify playlist "${args.playlistName}" (Genre: ${args.genre})
        and draft a highly personalized pitch email for the track "${args.trackTitle}".
        `;

        const data = await AutonomousIntelligence.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = PitchStorySchema.parse(data);

        const { auth, db } = await importWithRetry(() => import('@/services/firebase'));
        const uid = auth.currentUser?.uid;
        let docId: string | undefined;
        let saveError: string | undefined;
        if (uid) {
            try {
                const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
                const docRef = await addDoc(collection(db, 'users', uid, 'email_pitches'), {
                    ...validated,
                    playlistName: args.playlistName,
                    trackTitle: args.trackTitle,
                    createdAt: serverTimestamp()
                });
                docId = docRef.id;
            } catch (err: unknown) {
                saveError = err instanceof Error ? err.message : String(err);
                logger.warn('[PublicistTools] Failed to persist playlist pitch:', err);
            }
        } else {
            saveError = 'No user is signed in.';
        }

        return toolSuccess(
            { ...validated, saved: Boolean(docId), docId },
            docId
                ? `Personalized pitch email drafted and saved for Spotify playlist "${args.playlistName}" (ID: ${docId}).`
                : `Personalized pitch email drafted for Spotify playlist "${args.playlistName}", but NOT saved: ${saveError}`
        );
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases for historical reasons if needed, but the object is the preferred way
export const {
    write_press_release,
    generate_crisis_response,
    pitch_story,
    draft_pitch_email
} = PublicistTools;
