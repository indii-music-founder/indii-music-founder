import * as admin from 'firebase-admin';

import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models.js';
import { getVertexAIClient } from '../../lib/vertexClient.js';
import {
    failedOperationResult,
    operationResult,
    optionalIdempotencyKey,
    requireString,
    resolveOwnedRelease,
    toolResponse,
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

/**
 * Distribution/Publishing records (`proprietaryIngestionReleases`) keep their
 * release details in a nested `metadata` map (ExtendedGoldenMetadata), with
 * different key names. Map them onto the groundable fields; top-level values
 * win when both exist.
 */
const METADATA_FIELD_SOURCES: ReadonlyArray<readonly [typeof GROUNDABLE_STRING_FIELDS[number], readonly string[]]> = [
    ['title', ['releaseTitle', 'trackTitle']],
    ['artistName', ['artistName']],
    ['genre', ['genre']],
    ['subGenre', ['subGenre']],
    ['mood', ['mood']],
    ['label', ['labelName']],
    ['releaseDate', ['releaseDate']],
    ['language', ['language']],
];

function groundableString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 500);
    if (Array.isArray(value)) {
        const joined = value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map(item => item.trim()).join(', ');
        return joined ? joined.slice(0, 500) : undefined;
    }
    return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function extractGrounding(release: Record<string, unknown>): ReleaseGrounding {
    const fields: Record<string, string> = {};
    for (const key of GROUNDABLE_STRING_FIELDS) {
        const value = groundableString(release[key]);
        if (value) fields[key] = value;
    }
    const metadata = asRecord(release.metadata);
    if (metadata) {
        for (const [field, sources] of METADATA_FIELD_SOURCES) {
            if (fields[field]) continue;
            for (const source of sources) {
                const value = groundableString(metadata[source]);
                if (value) {
                    fields[field] = value;
                    break;
                }
            }
        }
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
    const metadataTrackTitle = groundableString(metadata?.trackTitle);
    if (trackTitles.length === 0 && metadataTrackTitle) trackTitles.push(metadataTrackTitle);
    return { fields, analysis, trackTitles };
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
            const { data: release } = await resolveOwnedRelease(firestore, actorUid, releaseId);
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
                    config: { temperature: 1.0 },
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
