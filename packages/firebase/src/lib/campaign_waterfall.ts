/**
 * Campaign waterfall Inngest consumer (P5, ISSUE-1100).
 *
 * Consumes `mcp/campaign.scheduled` events dispatched by the
 * schedule_campaign_waterfall MCP tool. For each planned event, durably
 * sleeps until that event's date, then flips its status planned -> scheduled.
 * The one outreach-style step (playlist_pitch_followup) additionally sends
 * a Resend email to the campaign owner — but ONLY when the campaign doc's
 * own emailOptIn flag is true. No email fires without that explicit opt-in.
 */
import { Inngest } from 'inngest';
import * as admin from 'firebase-admin';

import { sendTransactionalEmail } from './notify.js';

interface WaterfallEvent {
    key: string;
    label: string;
    date: string;
    status: string;
}

interface CampaignWaterfallPayload {
    campaignId: string;
    uid: string;
    events: WaterfallEvent[];
}

/** The only waterfall step that reaches a third party (playlist curators). */
const OUTREACH_EVENT_KEYS = new Set(['playlist_pitch_followup']);

export const campaignWaterfallFn = (inngestClient: Inngest) => inngestClient.createFunction(
    { id: 'campaign-waterfall-dispatch', retries: 3 },
    { event: 'mcp/campaign.scheduled' },
    async ({ event, step }) => {
        const { campaignId, uid, events } = event.data as CampaignWaterfallPayload;
        const db = admin.firestore();
        const campaignRef = db.collection('campaigns').doc(campaignId);

        for (const evt of events) {
            // Durable sleep: fires at 09:00 UTC on the event's date, even across
            // days/weeks — Inngest persists this across function-instance restarts.
            await step.sleepUntil(`wait-${evt.key}`, `${evt.date}T09:00:00.000Z`);

            const stillExists = await step.run(`check-exists-${evt.key}`, async () => {
                const snap = await campaignRef.get();
                return snap.exists;
            });
            if (!stillExists) {
                console.log(`[CampaignWaterfall] Campaign ${campaignId} no longer exists; skipping remaining steps.`);
                return { campaignId, status: 'aborted_campaign_deleted' };
            }

            await step.run(`update-status-${evt.key}`, async () => {
                // Read-modify-write on the whole `events` array — wrapped in a
                // transaction so a concurrent writer to this doc (another
                // waterfall step, a second dispatch of the same campaign event,
                // or a user edit) can't have its change silently overwritten by
                // a last-write-wins array clobber.
                await db.runTransaction(async (tx) => {
                    const snap = await tx.get(campaignRef);
                    const data = snap.data() || {};
                    const currentEvents = Array.isArray(data.events) ? data.events : [];
                    const updatedEvents = currentEvents.map((e: WaterfallEvent) =>
                        e.key === evt.key ? { ...e, status: 'scheduled' } : e
                    );
                    tx.update(campaignRef, {
                        events: updatedEvents,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
            });

            if (OUTREACH_EVENT_KEYS.has(evt.key)) {
                await step.run(`send-outreach-${evt.key}`, async () => {
                    const snap = await campaignRef.get();
                    const data = snap.data() || {};
                    if (data.emailOptIn !== true) {
                        console.log(`[CampaignWaterfall] emailOptIn not set for campaign ${campaignId}; skipping outreach email for ${evt.key}.`);
                        return;
                    }
                    const userSnap = await db.collection('users').doc(uid).get();
                    const email = userSnap.exists ? (userSnap.data()?.email as string | undefined) : undefined;
                    if (!email) {
                        console.warn(`[CampaignWaterfall] No email on file for uid ${uid}; skipping outreach email.`);
                        return;
                    }
                    await sendTransactionalEmail(
                        email,
                        `Campaign step due: ${evt.label}`,
                        `<p>Your campaign waterfall step "${evt.label}" is due today. Time to follow up with playlist curators.</p>`,
                    );
                });
            }
        }

        return { campaignId, status: 'waterfall_complete' };
    },
);
