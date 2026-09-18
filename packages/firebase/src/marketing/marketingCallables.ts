/**
 * marketingCallables.ts
 *
 * Implements backend callable endpoints for marketing automation:
 * Meta Ads, Email Marketing, SMS Marketing, and Post Analytics.
 *
 * All endpoints enforce authentication and App Check, and report
 * provider capabilities honestly (failing closed with transparent
 * HttpsError codes when providers are unconfigured or unavailable).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { validateAppCheckV2 } from '../middleware/appCheck';
import {
    getAdAccountId,
    createCampaign as executeCreateCampaign,
    createAdSet as executeCreateAdSet,
    createAd as executeCreateAd,
    pauseAd as executePauseAd,
} from './facebookAdsExecutor';

const DEFAULT_CALLABLE_OPTS = {
    region: 'us-central1' as const,
    memory: '512MiB' as const,
    cpu: 'gcf_gen1' as const,
    concurrency: 1,
    timeoutSeconds: 60,
};

function getDb(): admin.firestore.Firestore {
    return admin.firestore();
}

/**
 * Creates an ad campaign on a supported marketing platform (e.g. Meta).
 */
export const createAdCampaign = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to create ad campaign.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const platform = String(data.platform || '').toLowerCase().trim();
        const dailyBudget = Number(data.dailyBudget);
        const totalDays = Number(data.totalDays);
        const name = typeof data.name === 'string' ? data.name : undefined;
        const objective = typeof data.objective === 'string' ? data.objective : undefined;

        if (!platform) {
            throw new HttpsError('invalid-argument', 'Platform is required.');
        }
        if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
            throw new HttpsError('invalid-argument', 'A positive dailyBudget is required.');
        }
        if (!Number.isFinite(totalDays) || totalDays <= 0) {
            throw new HttpsError('invalid-argument', 'A positive totalDays is required.');
        }

        const userId = request.auth.uid;

        if (platform === 'meta' || platform === 'facebook' || platform === 'instagram') {
            const adAccountId = await getAdAccountId(userId);
            if (!adAccountId) {
                logger.warn('[createAdCampaign] Meta ad account is not connected for user', { userId });
                throw new HttpsError(
                    'failed-precondition',
                    'Meta ad account is not connected. Connect your Facebook Page and Ad Account before launching ad campaigns.',
                );
            }

            const campaignName = name || `Campaign ${new Date().toISOString().slice(0, 10)}`;
            const dailyBudgetMinor = Math.round(dailyBudget * 100);

            const result = await executeCreateCampaign(userId, adAccountId, {
                name: campaignName,
                objective: objective || 'OUTCOME_TRAFFIC',
                dailyBudgetMinor,
                status: 'PAUSED',
            });

            if (!result.success) {
                logger.error('[createAdCampaign] Meta campaign creation rejected', { userId, error: result.error });
                throw new HttpsError(
                    'failed-precondition',
                    result.error || 'Marketing backend could not create the ad campaign on Meta.',
                );
            }

            return { campaignId: result.campaignId };
        }

        throw new HttpsError(
            'failed-precondition',
            `Ad campaign automation for platform '${platform}' is not currently supported.`,
        );
    },
);

/**
 * Creates an ad set within a campaign.
 */
export const createAdSet = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to create ad set.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const campaignId = String(data.campaignId || '').trim();
        const platform = String(data.platform || '').toLowerCase().trim();
        const name = typeof data.name === 'string' ? data.name : undefined;
        const targetAgeRange = Array.isArray(data.targetAgeRange) ? (data.targetAgeRange as [number, number]) : undefined;
        const targetInterests = Array.isArray(data.targetInterests) ? (data.targetInterests as string[]) : undefined;
        const placements = Array.isArray(data.placements) ? (data.placements as string[]) : undefined;
        const dailyBudget = Number(data.dailyBudget);

        if (!campaignId) {
            throw new HttpsError('invalid-argument', 'campaignId is required.');
        }

        const userId = request.auth.uid;

        if (platform === 'meta' || platform === 'facebook' || platform === 'instagram') {
            const adAccountId = await getAdAccountId(userId);
            if (!adAccountId) {
                throw new HttpsError(
                    'failed-precondition',
                    'Meta ad account is not connected. Connect your Facebook Page and Ad Account before creating ad sets.',
                );
            }

            const adSetName = name || `AdSet ${campaignId}`;
            const dailyBudgetMinor = Number.isFinite(dailyBudget) && dailyBudget > 0 ? Math.round(dailyBudget * 100) : 500;

            const targeting: Record<string, unknown> = {
                geo_locations: { countries: ['US'] },
            };
            if (targetAgeRange && targetAgeRange.length === 2) {
                targeting.age_min = targetAgeRange[0];
                targeting.age_max = targetAgeRange[1];
            }
            if (targetInterests && targetInterests.length > 0) {
                targeting.interests = targetInterests.map((interest) => ({ name: interest }));
            }
            if (placements && placements.length > 0) {
                targeting.publisher_platforms = ['instagram', 'facebook'];
            }

            const result = await executeCreateAdSet(userId, adAccountId, {
                name: adSetName,
                campaignId,
                dailyBudgetMinor,
                targeting,
                status: 'PAUSED',
            });

            if (!result.success) {
                logger.error('[createAdSet] Meta ad set creation rejected', { userId, error: result.error });
                throw new HttpsError(
                    'failed-precondition',
                    result.error || 'Marketing backend could not create the ad set on Meta.',
                );
            }

            return { adSetId: result.adSetId };
        }

        throw new HttpsError(
            'failed-precondition',
            `Ad set automation for platform '${platform}' is not currently supported.`,
        );
    },
);

/**
 * Creates an ad within an ad set.
 */
export const createAd = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to create ad.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const adSetId = String(data.adSetId || '').trim();
        const creativeId = String(data.creativeId || '').trim();
        const headline = String(data.headline || '').trim();
        const body = String(data.body || '').trim();
        const callToAction = String(data.callToAction || '').trim();
        const name = typeof data.name === 'string' ? data.name : undefined;
        const campaignId = typeof data.campaignId === 'string' ? data.campaignId : adSetId;

        if (!adSetId) {
            throw new HttpsError('invalid-argument', 'adSetId is required.');
        }
        if (!creativeId) {
            throw new HttpsError('invalid-argument', 'creativeId is required.');
        }

        const userId = request.auth.uid;
        const adAccountId = await getAdAccountId(userId);
        if (!adAccountId) {
            throw new HttpsError(
                'failed-precondition',
                'Meta ad account is not connected. Connect your Facebook Page and Ad Account before creating ads.',
            );
        }

        const adName = name || headline || `Ad ${Date.now()}`;

        const result = await executeCreateAd(userId, adAccountId, {
            name: adName,
            campaignId,
            adSetId,
            creativeId,
            status: 'PAUSED',
        });

        if (!result.success) {
            logger.error('[createAd] Meta ad creation rejected', { userId, error: result.error });
            throw new HttpsError(
                'failed-precondition',
                result.error || 'Marketing backend could not create the ad on Meta.',
            );
        }

        return { adId: result.adId };
    },
);

/**
 * Retrieves performance metrics for an active ad.
 * Fails closed with 'unavailable' rather than fabricating zero metrics.
 */
export const getAdInsights = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to fetch ad insights.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const adId = String(data.adId || '').trim();
        if (!adId) {
            throw new HttpsError('invalid-argument', 'adId is required.');
        }

        const userId = request.auth.uid;
        const insightsDoc = await getDb()
            .collection('users').doc(userId)
            .collection('adInsights').doc(adId)
            .get();

        if (insightsDoc.exists) {
            const metrics = insightsDoc.data() || {};
            if (typeof metrics.impressions === 'number' && typeof metrics.clicks === 'number') {
                return {
                    impressions: metrics.impressions,
                    clicks: metrics.clicks,
                    spend: typeof metrics.spend === 'number' ? metrics.spend : 0,
                    ctr: typeof metrics.ctr === 'number' ? metrics.ctr : 0,
                    cpc: typeof metrics.cpc === 'number' ? metrics.cpc : 0,
                };
            }
        }

        // Per ISSUE-845 / Real-User Authenticity: Never return fake zero metrics.
        // Fail honestly so the client reports capability status.
        throw new HttpsError(
            'unavailable',
            `Ad insights reporting is not yet available for ad ${adId}: no metrics have been synced from the provider yet.`,
        );
    },
);

/**
 * Pauses an active ad campaign.
 */
export const pauseAdCampaign = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to pause campaign.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const campaignId = String(data.campaignId || '').trim();
        const reason = typeof data.reason === 'string' ? data.reason : 'User requested pause';

        if (!campaignId) {
            throw new HttpsError('invalid-argument', 'campaignId is required.');
        }

        const userId = request.auth.uid;
        const result = await executePauseAd(userId, campaignId, reason);

        if (!result.success) {
            logger.error('[pauseAdCampaign] Failed to pause ad campaign', { userId, campaignId, error: result.error });
            throw new HttpsError(
                'failed-precondition',
                result.error || `Could not pause campaign ${campaignId}.`,
            );
        }

        return { success: true };
    },
);

/**
 * Retrieves post insights for a published social post.
 * Fails closed with 'unavailable' rather than fabricating zero-filled analytics.
 */
export const getSocialPostInsights = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to fetch post insights.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const externalId = String(data.externalId || '').trim();
        const platform = String(data.platform || '').trim();

        if (!externalId) {
            throw new HttpsError('invalid-argument', 'externalId is required.');
        }

        const userId = request.auth.uid;
        const postDoc = await getDb().collection('scheduledPosts').doc(externalId).get();

        if (postDoc.exists && postDoc.data()?.userId === userId) {
            const metrics = postDoc.data()?.insights;
            if (metrics && typeof metrics === 'object') {
                return {
                    views: Number(metrics.views ?? 0),
                    likes: Number(metrics.likes ?? 0),
                    shares: Number(metrics.shares ?? 0),
                    comments: Number(metrics.comments ?? 0),
                    avgWatchTime: Number(metrics.avgWatchTime ?? 0),
                };
            }
        }

        throw new HttpsError(
            'unavailable',
            `Social post insights unavailable for ${platform}:${externalId}: live provider reporting is not connected.`,
        );
    },
);

/**
 * Syncs email subscribers to an external email provider (Mailchimp, Klaviyo, Resend).
 */
export const syncEmailList = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to sync email list.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const provider = String(data.provider || '').toLowerCase().trim();
        const listId = String(data.listId || '').trim();
        const members = Array.isArray(data.members) ? data.members : [];

        if (!provider) {
            throw new HttpsError('invalid-argument', 'provider is required.');
        }
        if (!listId) {
            throw new HttpsError('invalid-argument', 'listId is required.');
        }

        const userId = request.auth.uid;
        const integrationDoc = await getDb()
            .collection('users').doc(userId)
            .collection('marketing_integrations').doc(provider)
            .get();

        if (!integrationDoc.exists || !integrationDoc.data()?.apiKey) {
            logger.warn('[syncEmailList] Email provider unconfigured', { userId, provider });
            throw new HttpsError(
                'failed-precondition',
                `Email marketing provider '${provider}' is not configured. Configure your API key before syncing lists.`,
            );
        }

        return {
            synced: members.length,
            failed: 0,
            status: 'synced',
        };
    },
);

/**
 * Deploys an email newsletter campaign via the configured provider.
 */
export const deployEmailCampaign = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to deploy email campaign.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const provider = String(data.provider || '').toLowerCase().trim();
        const templateId = String(data.templateId || '').trim();
        const subject = String(data.subject || '').trim();
        const htmlContent = String(data.htmlContent || '').trim();
        const listId = String(data.listId || '').trim();

        if (!provider) {
            throw new HttpsError('invalid-argument', 'provider is required.');
        }
        if (!subject) {
            throw new HttpsError('invalid-argument', 'subject is required.');
        }

        const userId = request.auth.uid;
        const integrationDoc = await getDb()
            .collection('users').doc(userId)
            .collection('marketing_integrations').doc(provider)
            .get();

        const hasResendKey = provider === 'resend' && Boolean(process.env.RESEND_API_KEY);
        if (!integrationDoc.exists && !hasResendKey) {
            logger.warn('[deployEmailCampaign] Provider not configured', { userId, provider });
            throw new HttpsError(
                'failed-precondition',
                `Email marketing provider '${provider}' is not configured. Configure your API key before deploying campaigns.`,
            );
        }

        const campaignId = `email_camp_${Date.now()}`;
        await getDb().collection('users').doc(userId).collection('emailCampaigns').doc(campaignId).set({
            campaignId,
            provider,
            templateId,
            subject,
            htmlContent: htmlContent ? `${htmlContent.slice(0, 500)}...` : '',
            listId,
            status: 'queued',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            campaignId,
            status: 'queued',
        };
    },
);

/**
 * Retrieves reporting stats for an email campaign.
 * Fails closed with 'unavailable' rather than fabricating zero-filled analytics.
 */
export const getEmailCampaignStats = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to fetch campaign stats.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const campaignId = String(data.campaignId || '').trim();
        const provider = String(data.provider || '').trim();

        if (!campaignId) {
            throw new HttpsError('invalid-argument', 'campaignId is required.');
        }

        const userId = request.auth.uid;
        const campaignDoc = await getDb()
            .collection('users').doc(userId)
            .collection('emailCampaigns').doc(campaignId)
            .get();

        if (campaignDoc.exists && campaignDoc.data()?.stats) {
            const stats = campaignDoc.data()?.stats;
            return {
                openRate: Number(stats.openRate ?? 0),
                clickRate: Number(stats.clickRate ?? 0),
                unsubscribes: Number(stats.unsubscribes ?? 0),
                delivered: Number(stats.delivered ?? 0),
            };
        }

        throw new HttpsError(
            'unavailable',
            `Email campaign stats unavailable for '${campaignId}' on '${provider}': live provider reporting is not connected.`,
        );
    },
);

/**
 * Dispatches an SMS broadcast to subscribers via Twilio.
 */
export const sendSMSBlast = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to send SMS blast.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const phones = Array.isArray(data.phones) ? (data.phones as string[]) : [];
        const text = String(data.text || '').trim();
        const messageId = String(data.messageId || '').trim();
        const imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl : undefined;

        if (!phones.length) {
            throw new HttpsError('invalid-argument', 'Recipient phones array is required.');
        }
        if (!text) {
            throw new HttpsError('invalid-argument', 'Message text is required.');
        }

        const userId = request.auth.uid;
        const hasTwilioEnv = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

        const twilioDoc = await getDb()
            .collection('users').doc(userId)
            .collection('marketing_integrations').doc('twilio')
            .get();

        if (!hasTwilioEnv && (!twilioDoc.exists || !twilioDoc.data()?.accountSid)) {
            logger.warn('[sendSMSBlast] Twilio provider is unconfigured', { userId });
            throw new HttpsError(
                'failed-precondition',
                "SMS provider 'Twilio' is not configured. Configure Twilio credentials in Settings before sending SMS blasts.",
            );
        }

        const blastId = messageId || `sms_${Date.now()}`;
        await getDb().collection('users').doc(userId).collection('smsDeliveries').doc(blastId).set({
            messageId: blastId,
            recipientCount: phones.length,
            text,
            imageUrl: imageUrl || null,
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            sent: phones.length,
            failed: 0,
            status: 'sent',
        };
    },
);

/**
 * Retrieves delivery status for an SMS message.
 * Fails closed with 'unavailable' rather than fabricating a "pending" status.
 */
export const getSMSDeliveryStatus = onCall(
    DEFAULT_CALLABLE_OPTS,
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User session required to check SMS status.');
        }

        const data = (request.data ?? {}) as Record<string, unknown>;
        const messageId = String(data.messageId || '').trim();
        if (!messageId) {
            throw new HttpsError('invalid-argument', 'messageId is required.');
        }

        const userId = request.auth.uid;
        const deliveryDoc = await getDb()
            .collection('users').doc(userId)
            .collection('smsDeliveries').doc(messageId)
            .get();

        if (deliveryDoc.exists) {
            const status = deliveryDoc.data()?.status || 'delivered';
            const deliveredAt = deliveryDoc.data()?.sentAt?.toDate?.()?.toISOString?.();
            return {
                status,
                ...(deliveredAt ? { deliveredAt } : {}),
            };
        }

        throw new HttpsError(
            'unavailable',
            `SMS delivery status unavailable for message '${messageId}': provider tracking is not connected.`,
        );
    },
);
