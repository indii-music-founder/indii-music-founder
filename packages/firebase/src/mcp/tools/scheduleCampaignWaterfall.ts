import { failedOperationResult, operationResult, requireString, toolResponse, verifyReleaseOwnership } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

interface WaterfallEvent extends Record<string, unknown> {
    key: string;
    label: string;
    date: string;
    status: 'planned';
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a strict YYYY-MM-DD string to a UTC Date, rejecting invalid calendar dates (e.g. 2026-02-30). */
function parseCampaignStartDate(value: string): Date {
    if (!DATE_PATTERN.test(value)) {
        throw new TypeError('campaignStartDate must be a YYYY-MM-DD date string.');
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new TypeError(`campaignStartDate "${value}" is not a valid calendar date.`);
    }
    return parsed;
}

function addDaysIso(start: Date, days: number): string {
    const shifted = new Date(start.getTime());
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
}

const WATERFALL_STEPS: ReadonlyArray<{ key: string; label: string; offsetDays: number }> = [
    { key: 'announce', label: 'Announce the release', offsetDays: -21 },
    { key: 'presave_push', label: 'Pre-save push', offsetDays: -14 },
    { key: 'teaser_content', label: 'Teaser content', offsetDays: -7 },
    { key: 'release_day', label: 'Release day', offsetDays: 0 },
    { key: 'playlist_pitch_followup', label: 'Playlist-pitch follow-up', offsetDays: 3 },
    { key: 'recap_ugc_push', label: 'Recap / UGC push', offsetDays: 14 },
];

function buildWaterfall(start: Date): WaterfallEvent[] {
    return WATERFALL_STEPS.map((step) => ({
        key: step.key,
        label: step.label,
        date: addDaysIso(start, step.offsetDays),
        status: 'planned',
    }));
}

function optionalBudget(args: Record<string, unknown>): number | undefined {
    const value = args.budget;
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError('budget must be a finite number greater than or equal to 0.');
    }
    return value;
}

export const scheduleCampaignWaterfall: IndiiMcpTool = {
    name: 'schedule_campaign_waterfall',
    description: 'Persists a deterministic campaign timeline (announce → pre-save → teaser → release → follow-up → recap) for an owned release and dispatches it to Inngest for durable, date-gated execution. Outreach emails require the campaign\'s own emailOptIn flag.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string', description: 'Authenticated owner release identifier.' },
            campaignStartDate: { type: 'string', description: 'Release day anchor, YYYY-MM-DD.' },
            budget: { type: 'number', description: 'Optional campaign budget (USD), must be >= 0.' },
            emailOptIn: { type: 'boolean', description: 'Must be true for the outreach step (playlist_pitch_followup) to send an email. Defaults to false.' },
        },
        required: ['releaseId', 'campaignStartDate'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let releaseId = 'unknown';
        try {
            releaseId = requireString(args, 'releaseId', 200);
            const startDateString = requireString(args, 'campaignStartDate', 10);
            const startDate = parseCampaignStartDate(startDateString);
            const budget = optionalBudget(args);
            const emailOptIn = args.emailOptIn === true;

            const admin = await import('firebase-admin');
            const firestore = admin.firestore();
            await verifyReleaseOwnership(firestore, actorUid, releaseId);

            const events = buildWaterfall(startDate);
            // Whitelisted, schema-declared fields only — never the raw args object.
            const campaignDoc: Record<string, unknown> = {
                releaseId,
                initiatorUid: actorUid,
                startDate: startDateString,
                ...(budget !== undefined ? { budget } : {}),
                events,
                status: 'scheduled',
                engine: 'inngest',
                emailOptIn,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const docRef = await firestore.collection('campaigns').add(campaignDoc);

            const { getInngestClient } = await import('../../lib/inngestClient.js');
            const inngest = getInngestClient();
            await inngest.send({
                name: 'mcp/campaign.scheduled',
                data: { campaignId: docRef.id, uid: actorUid, events },
                user: { id: actorUid },
            });

            return toolResponse(operationResult({
                tool: 'schedule_campaign_waterfall',
                actorUid,
                status: 'succeeded',
                resourceType: 'campaign_waterfall',
                resourceId: docRef.id,
                data: { campaignId: docRef.id, events } as Record<string, unknown>,
                warnings: [
                    'Timeline dispatched to Inngest for durable, date-gated execution — each step fires on its own date, not immediately.',
                    emailOptIn
                        ? 'emailOptIn is true: the playlist_pitch_followup step will send an outreach email when its date arrives.'
                        : 'emailOptIn is false (default): no email will be sent for any step, including playlist_pitch_followup.',
                ],
            }));
        } catch (error) {
            const invalidArgument = error instanceof TypeError;
            return toolResponse(failedOperationResult({
                tool: 'schedule_campaign_waterfall',
                actorUid,
                resourceType: 'campaign_waterfall',
                resourceId: releaseId,
                code: invalidArgument ? 'INVALID_ARGUMENT' : (error instanceof Error && error.message.startsWith('Forbidden') ? 'PERMISSION_DENIED' : 'CAMPAIGN_SCHEDULE_FAILED'),
                message: error instanceof Error ? error.message : 'Campaign waterfall scheduling failed.',
                retryable: false,
            }));
        }
    },
};
