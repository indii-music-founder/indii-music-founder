import * as admin from 'firebase-admin';

import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models.js';
import { getVertexAIClient } from '../../lib/vertexClient.js';
import {
    failedOperationResult,
    operationResult,
    optionalIdempotencyKey,
    requireString,
    toolResponse,
    verifyReleaseOwnership,
    OwnershipFirestore,
} from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

const TOOL_NAME = 'generate_playlist_pitch';

/** Release fields we are willing to ground the pitch on. Nothing else leaves Firestore. */
const GROUNDABLE_STRING_FIELDS = ['title', 'artistName', 'artist', 'genre', 'subGenre', 'mood', 'label', 'releaseDate', 'description', 'language'] as const;
const GROUNDABLE_ANALYSIS_KEYS = ['audioDna', 'audioAnalysis', 'sonicProfile'] as const;

interface ReleaseGrounding {
    fields: Record<string, string>;
    analysis: Record<string, unknown>;
    trackTitles: string[];
}

function extractGrounding(release: Record<string, unknown>): ReleaseGrounding {
    const fields: Record<string, string> = {};
    for (const key of GROUNDABLE_STRING_FIELDS) {
        const value = release[key];
        if (typeof value === 'string' && value.trim()) fields[key] = value.trim().slice(0, 500);
    }
    const analysis: Record<string, unknown> = {};
    for (const key of GROUNDABLE_ANALYSIS_KEYS) {
        const value = release[key];
        if (value && typeof value === 'object') analysis[key] = value;
    }
    const rawTracks = release.tracks;
    const trackTitles = Array.isArray(rawTracks)
        ? rawTracks
            .map((track) => (track && typeof track === 'object' ? (track as Record<string, unknown>).title : undefined))
            .filter((title): title is string => typeof title === 'string' && !!title.trim())
            .slice(0, 50)
        : [];
    return { fields, analysis, trackTitles };
}

async function fetchOwnedRelease(firestore: OwnershipFirestore, uid: string, releaseId: string): Promise<Record<string, unknown>> {
    const owned = await firestore.collection('users').doc(uid).collection('releases').doc(releaseId).get();
    if (owned.exists) return owned.data() ?? {};
    const topLevel = await firestore.collection('releases').doc(releaseId).get();
    if (topLevel.exists) return topLevel.data() ?? {};
    // verifyReleaseOwnership already passed, so this should not happen; fail closed anyway.
    throw new Error('Release document disappeared between ownership check and read.');
}

function buildPrompt(grounding: ReleaseGrounding, targetPlaylist: string, curatorName?: string): string {
    return [
        'You are drafting a playlist pitch email for an independent music artist.',
        `Target playlist: ${targetPlaylist}.`,
        curatorName ? `Curator name: ${curatorName}.` : 'Curator name unknown — use a neutral greeting.',
        '',
        'Ground the pitch ONLY in the verified release data below. STRICT RULES:',
        '- Do NOT invent stream counts, listener numbers, chart positions, press quotes, or prior playlist placements.',
        '- Do NOT fabricate collaborations, label affiliations, or tour history.',
        '- If a detail is not in the data, leave it out rather than guessing.',
        '- Keep it concise (under 200 words), professional, and specific to the sonic character described.',
        '',
        'Verified release data (JSON):',
        JSON.stringify({ ...grounding.fields, trackTitles: grounding.trackTitles, analysis: grounding.analysis }, null, 2),
        '',
        'Return only the email draft text (subject line first), no commentary.',
    ].join('\n');
}

export const generatePlaylistPitch: IndiiMcpTool = {
    name: TOOL_NAME,
    description: 'Drafts a playlist pitch email grounded in the authenticated caller\'s real release data and audio analysis. Returns a DRAFT only — nothing is sent to any curator or platform.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string', description: 'Release ID owned by the authenticated caller.' },
            targetPlaylist: { type: 'string', description: 'Name of the playlist being pitched (e.g., RapCaviar).' },
            curatorName: { type: 'string', description: 'Optional curator name for the greeting.' },
            idempotencyKey: { type: 'string', description: 'Optional idempotency key (8-128 safe identifier characters).' },
        },
        required: ['releaseId', 'targetPlaylist'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let releaseId = 'unknown';
        try {
            releaseId = requireString(args, 'releaseId', 200);
            const targetPlaylist = requireString(args, 'targetPlaylist', 200);
            const curatorName = args.curatorName === undefined ? undefined : requireString(args, 'curatorName', 120);
            const idempotencyKey = optionalIdempotencyKey(args);

            const firestore = admin.firestore() as unknown as OwnershipFirestore;
            await verifyReleaseOwnership(firestore, actorUid, releaseId);
            const release = await fetchOwnedRelease(firestore, actorUid, releaseId.trim());
            const grounding = extractGrounding(release);

            if (Object.keys(grounding.fields).length === 0) {
                return toolResponse(failedOperationResult({
                    tool: TOOL_NAME,
                    actorUid,
                    resourceType: 'playlist_pitch_draft',
                    resourceId: releaseId,
                    code: 'INSUFFICIENT_RELEASE_DATA',
                    message: 'Release has no usable metadata (title/genre/mood/etc.) to ground a pitch. Add release details first — refusing to fabricate.',
                    retryable: false,
                }));
            }

            let pitchDraft: string;
            try {
                const genai = getVertexAIClient();
                const response = await genai.models.generateContent({
                    model: FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO,
                    contents: buildPrompt(grounding, targetPlaylist, curatorName),
                    config: { temperature: 0.7 },
                });
                pitchDraft = response.text?.trim() ?? '';
            } catch (error) {
                return toolResponse(failedOperationResult({
                    tool: TOOL_NAME,
                    actorUid,
                    resourceType: 'playlist_pitch_draft',
                    resourceId: releaseId,
                    code: 'BACKEND_UNAVAILABLE',
                    message: `Vertex text generation failed: ${error instanceof Error ? error.message : String(error)}. No pitch was generated.`,
                    retryable: true,
                }));
            }
            if (!pitchDraft) {
                return toolResponse(failedOperationResult({
                    tool: TOOL_NAME,
                    actorUid,
                    resourceType: 'playlist_pitch_draft',
                    resourceId: releaseId,
                    code: 'EMPTY_MODEL_RESPONSE',
                    message: 'Vertex returned an empty response; no pitch draft was produced.',
                    retryable: true,
                }));
            }

            return toolResponse(operationResult({
                tool: TOOL_NAME,
                actorUid,
                status: 'succeeded',
                resourceType: 'playlist_pitch_draft',
                resourceId: releaseId,
                idempotencyKey,
                warnings: [
                    'DRAFT ONLY: this pitch was generated for review and was NOT sent to any curator, playlist, or platform.',
                    'The draft is grounded only in stored release metadata; verify all claims before sending manually.',
                ],
                data: {
                    pitchDraft,
                    targetPlaylist,
                    ...(curatorName ? { curatorName } : {}),
                    groundedFields: Object.keys(grounding.fields),
                    groundedAnalysisKeys: Object.keys(grounding.analysis),
                    trackTitleCount: grounding.trackTitles.length,
                    model: FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO,
                },
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: TOOL_NAME,
                actorUid,
                resourceType: 'playlist_pitch_draft',
                resourceId: releaseId,
                code: error instanceof TypeError ? 'INVALID_ARGUMENT' : 'PITCH_DRAFT_FAILED',
                message: error instanceof Error ? error.message : 'Playlist pitch draft failed.',
                retryable: false,
            }));
        }
    },
};
