/**
 * ISSUE-1709: model-facing declarations for the remote MCP tools wired in
 * McpTools.ts. Without these the agents had the functions but the model was
 * never told they exist. Argument names and required fields mirror each
 * tool's `inputSchema` in packages/firebase/src/mcp/tools/ (pinned by
 * McpToolDeclarations.test.ts); a mismatch makes the server reject the call
 * before any work runs (ISSUE-1706).
 */
import type { FunctionDeclaration } from '../types';

export const FETCH_BRAND_KIT_DECLARATION: FunctionDeclaration = {
    name: 'fetch_brand_kit',
    description: "Fetch the artist's saved brand kit (colors, fonts, logos, tone) from the backend.",
    parameters: {
        type: 'OBJECT',
        properties: {
            artistId: { type: 'STRING', description: "The artist's user id (the signed-in artist)." },
        },
        required: ['artistId'],
    },
};

export const QUEUE_RELEASE_CANVAS_RENDER_DECLARATION: FunctionDeclaration = {
    name: 'queue_release_canvas_render',
    description: 'Queue a looping canvas video render for one of the artist\'s releases. Returns a render job; it does not post anywhere.',
    parameters: {
        type: 'OBJECT',
        properties: {
            releaseId: { type: 'STRING', description: 'Release the artist owns.' },
            canvasType: { type: 'STRING', enum: ['Spotify', 'TikTok', 'Instagram'], description: 'Where the canvas will be used.' },
            animationSpec: {
                type: 'OBJECT',
                description: 'Optional: template, durationSeconds (1-600), colorPalette (up to 10 colors), textOverlay.',
                properties: {
                    template: { type: 'STRING' },
                    durationSeconds: { type: 'NUMBER' },
                    colorPalette: { type: 'ARRAY', items: { type: 'STRING' } },
                    textOverlay: { type: 'STRING' },
                },
            },
        },
        required: ['releaseId', 'canvasType'],
    },
};

export const AUDIT_ASSET_RESOLUTIONS_DECLARATION: FunctionDeclaration = {
    name: 'audit_asset_resolutions',
    description: "Check a release's artwork and media against store resolution requirements.",
    parameters: {
        type: 'OBJECT',
        properties: {
            releaseId: { type: 'STRING', description: 'Release the artist owns.' },
        },
        required: ['releaseId'],
    },
};

export const DRAFT_DSP_METADATA_DECLARATION: FunctionDeclaration = {
    name: 'draft_dsp_metadata',
    description: 'Draft the store delivery metadata (XML) for a release. Draft mode fills and flags missing dates; delivery mode requires them.',
    parameters: {
        type: 'OBJECT',
        properties: {
            releaseTitle: { type: 'STRING', description: 'Title of the release.' },
            artists: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Primary artists.' },
            genre: { type: 'STRING' },
            isrc: { type: 'STRING', description: 'Sound recording ISRC (12 characters).' },
            upc: { type: 'STRING', description: 'UPC (12 or 13 digits).' },
            duration: { type: 'STRING', description: 'ISO 8601 duration, e.g. PT3M30S. Required in delivery mode.' },
            releaseDate: { type: 'STRING', description: 'YYYY-MM-DD. Required in delivery mode.' },
            mode: { type: 'STRING', enum: ['draft', 'delivery'], description: 'draft (default) or delivery.' },
        },
        required: ['releaseTitle', 'artists', 'genre', 'upc', 'isrc'],
    },
};

export const CALCULATE_RECOUPMENT_DECLARATION: FunctionDeclaration = {
    name: 'calculate_recoupment',
    description: "Calculate a release's recoupment position from its recorded earnings and costs.",
    parameters: {
        type: 'OBJECT',
        properties: {
            releaseId: { type: 'STRING', description: 'Release the artist owns.' },
        },
        required: ['releaseId'],
    },
};

export const STAGE_STRIPE_PAYOUTS_DECLARATION: FunctionDeclaration = {
    name: 'stage_stripe_payouts',
    description: 'Stage a royalty payout figure for a month for later human approval. Never moves money.',
    parameters: {
        type: 'OBJECT',
        properties: {
            artistId: { type: 'STRING', description: "The artist's user id (the signed-in artist)." },
            payoutPeriod: { type: 'STRING', description: 'Payout month in YYYY-MM format.' },
        },
        required: ['artistId', 'payoutPeriod'],
    },
};

export const REGISTER_SPLIT_SHEET_DECLARATION: FunctionDeclaration = {
    name: 'register_split_sheet',
    description: 'Record a split sheet for a track. Percentages must add up to 100.',
    parameters: {
        type: 'OBJECT',
        properties: {
            trackId: { type: 'STRING', description: 'Track the splits apply to.' },
            releaseId: { type: 'STRING', description: 'Optional release id; checks the artist owns it.' },
            collaborators: {
                type: 'ARRAY',
                description: '1-20 collaborators.',
                items: {
                    type: 'OBJECT',
                    properties: {
                        name: { type: 'STRING' },
                        percentage: { type: 'NUMBER' },
                    },
                    required: ['name', 'percentage'],
                },
            },
            idempotencyKey: { type: 'STRING', description: 'Optional 8-128 character key so a retry does not register twice.' },
        },
        required: ['trackId', 'collaborators'],
    },
};

export const DRAFT_CWR_REGISTRATION_DECLARATION: FunctionDeclaration = {
    name: 'draft_cwr_registration',
    description: 'Draft a CWR work-registration batch for a release (for The MLC, SESAC or MusicMark). Draft only; nothing is sent.',
    parameters: {
        type: 'OBJECT',
        properties: {
            releaseId: { type: 'STRING', description: 'Release the artist owns.' },
            batch: {
                type: 'OBJECT',
                description: 'CWR batch: version, recipient (musicmark, the_mlc or sesac), sender {name, ipi, code}, fileSequence, createdAt (ISO UTC) and works with writers, publishers and ownership shares.',
            },
        },
        required: ['releaseId', 'batch'],
    },
};

export const AUDIT_SAMPLE_CLEARANCE_DECLARATION: FunctionDeclaration = {
    name: 'audit_sample_clearance',
    description: 'Check a track for sample-clearance gaps.',
    parameters: {
        type: 'OBJECT',
        properties: {
            trackId: { type: 'STRING', description: 'Track to check.' },
            releaseId: { type: 'STRING', description: 'Optional release id; checks the artist owns it.' },
        },
        required: ['trackId'],
    },
};
