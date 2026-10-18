/**
 * adCampaignCallables — Layer 2/3 Cloud Function Entrypoints
 *
 * Exposes authenticated Gen 2 Firebase Callable endpoints for:
 * 1. `executeUnifiedCampaignDirective`: Coordinates post-mastering asset
 *    verification, Jev (`jev-latest`) System One allocation refinement,
 *    transactional Finance Recoupment Ledger reservation/commit, and
 *    multi-platform ad provisioning across Meta, TikTok, and Google Ads.
 * 2. `ingestUnifiedAttributionEvent`: Validates and fans out server-side
 *    attribution events (`SmartlinkView`, `DSPOutboundClick`, `PreSaveComplete`,
 *    `WaitlistSignup`, `MerchPurchase`) across Meta CAPI, TikTok Events API,
 *    and Google Ads Enhanced Conversions with Firestore-backed idempotency.
 */

import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { ZodError } from 'zod';

import { typesafeApiKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import {
    type IAdPlatformAdapter,
    UnifiedAttributionEventSchema,
    UnifiedCampaignDirectiveSchema,
} from '../../types/ad-execution.types';
import { GoogleAdsAdapter, type GoogleAdsAdapterConfig } from '../../execution/ad-adapters/google-ads.adapter';
import { MetaAdAdapter, type MetaAdapterConfig } from '../../execution/ad-adapters/meta.adapter';
import { TikTokAdAdapter, type TikTokAdapterConfig } from '../../execution/ad-adapters/tiktok.adapter';
import { AttributionBus, type AttributionFanOutReceipt } from '../../execution/attribution/attribution-bus';
import {
    FirestoreAttributionDeduplicationStore,
    type FirestoreLikeDb,
} from '../../execution/attribution/firestore-attribution-store';
import { evaluateCampaignAllocationWithJev } from '../../orchestration/marketing/campaign-judgments';
import {
    CampaignOrchestrator,
    DefaultPostMasteringAssetVerifier,
    type OrchestratedCampaignExecutionResult,
} from '../../orchestration/marketing/campaign-orchestrator';
import {
    FirestoreFinanceRecoupmentLedger,
    type TransactionalFirestoreDb,
} from '../../orchestration/marketing/firestore-recoupment-ledger';

export interface StoredArtistAdConnections {
    meta?: Partial<MetaAdapterConfig>;
    tiktok?: Partial<TikTokAdapterConfig>;
    googleAds?: Partial<GoogleAdsAdapterConfig>;
}

/**
 * Resolves configured platform adapters for an authenticated artist from
 * `users/{artistId}/integrations/adPlatforms` (falling back to environment
 * variables if configured at the deployment level). Platforms without complete
 * credentials are omitted so `CampaignOrchestrator` and `AttributionBus` report
 * explicit `ADAPTER_NOT_REGISTERED` states instead of fabricating mock receipts.
 */
export async function resolveArtistAdPlatformAdapters(
    artistId: string,
    db: FirebaseFirestore.Firestore = admin.firestore(),
): Promise<IAdPlatformAdapter[]> {
    let stored: StoredArtistAdConnections = {};
    try {
        const snap = await db
            .collection('users')
            .doc(artistId)
            .collection('integrations')
            .doc('adPlatforms')
            .get();
        if (snap.exists) {
            stored = (snap.data() ?? {}) as StoredArtistAdConnections;
        }
    } catch (err) {
        logger.warn('[adCampaignCallables] Could not read adPlatforms integration doc', {
            artistId,
            error: err instanceof Error ? err.message : String(err),
        });
    }

    const adapters: IAdPlatformAdapter[] = [];

    const metaConfig: MetaAdapterConfig = {
        adAccountId: stored.meta?.adAccountId ?? process.env.META_AD_ACCOUNT_ID ?? '',
        accessToken: stored.meta?.accessToken ?? process.env.META_ACCESS_TOKEN ?? '',
        facebookPageId: stored.meta?.facebookPageId ?? process.env.META_FACEBOOK_PAGE_ID ?? '',
        instagramActorId: stored.meta?.instagramActorId ?? process.env.META_INSTAGRAM_ACTOR_ID,
        pixelId: stored.meta?.pixelId ?? process.env.META_PIXEL_ID ?? '',
    };
    if (
        metaConfig.adAccountId.trim() &&
        metaConfig.accessToken.trim() &&
        metaConfig.facebookPageId.trim() &&
        metaConfig.pixelId.trim()
    ) {
        adapters.push(new MetaAdAdapter(metaConfig));
    }

    const tiktokConfig: TikTokAdapterConfig = {
        advertiserId: stored.tiktok?.advertiserId ?? process.env.TIKTOK_ADVERTISER_ID ?? '',
        accessToken: stored.tiktok?.accessToken ?? process.env.TIKTOK_ACCESS_TOKEN ?? '',
        pixelCode: stored.tiktok?.pixelCode ?? process.env.TIKTOK_PIXEL_CODE ?? '',
        customIdentityId: stored.tiktok?.customIdentityId ?? process.env.TIKTOK_CUSTOM_IDENTITY_ID,
    };
    if (
        tiktokConfig.advertiserId.trim() &&
        tiktokConfig.accessToken.trim() &&
        tiktokConfig.pixelCode.trim()
    ) {
        adapters.push(new TikTokAdAdapter(tiktokConfig));
    }

    const googleConfig: GoogleAdsAdapterConfig = {
        customerId: stored.googleAds?.customerId ?? process.env.GOOGLE_ADS_CUSTOMER_ID ?? '',
        developerToken: stored.googleAds?.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
        accessToken: stored.googleAds?.accessToken ?? process.env.GOOGLE_ADS_ACCESS_TOKEN ?? '',
        loginCustomerId: stored.googleAds?.loginCustomerId ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
        conversionActionId:
            stored.googleAds?.conversionActionId ?? process.env.GOOGLE_ADS_CONVERSION_ACTION_ID ?? '',
    };
    if (
        googleConfig.customerId.trim() &&
        googleConfig.developerToken.trim() &&
        googleConfig.accessToken.trim() &&
        googleConfig.conversionActionId.trim()
    ) {
        adapters.push(new GoogleAdsAdapter(googleConfig));
    }

    return adapters;
}

/**
 * Pure handler for executing a `UnifiedCampaignDirective` on behalf of an
 * authenticated artist. Separated from the `onCall` wrapper for deterministic
 * unit testing.
 */
export async function handleExecuteUnifiedCampaignDirective(
    authenticatedUid: string,
    rawPayload: unknown,
    deps?: {
        adapters?: ReadonlyArray<IAdPlatformAdapter>;
        ledger?: FirestoreFinanceRecoupmentLedger;
        allocationJudge?: typeof evaluateCampaignAllocationWithJev;
        onReceiptPersist?: (result: OrchestratedCampaignExecutionResult) => Promise<void>;
    },
): Promise<OrchestratedCampaignExecutionResult> {
    const parsedDirective = UnifiedCampaignDirectiveSchema.parse(rawPayload);

    // Pin artistId to the authenticated caller so no caller can spend another
    // artist's recoupment ledger or provision ads under another artist's account.
    if (parsedDirective.artistId !== authenticatedUid) {
        throw new HttpsError(
            'permission-denied',
            'Directive artistId must match the authenticated user.',
        );
    }

    const adapters =
        deps?.adapters ?? (await resolveArtistAdPlatformAdapters(authenticatedUid));
    const ledger =
        deps?.ledger ??
        new FirestoreFinanceRecoupmentLedger({
            db: admin.firestore() as unknown as TransactionalFirestoreDb,
        });
    const allocationJudge = deps?.allocationJudge ?? evaluateCampaignAllocationWithJev;

    const orchestrator = new CampaignOrchestrator({
        adapters,
        financeLedger: ledger,
        assetVerifier: new DefaultPostMasteringAssetVerifier(),
        campaignJudge: (directive, priorTelemetry) =>
            allocationJudge(directive, priorTelemetry),
    });

    const result = await orchestrator.executeDirective(parsedDirective);

    if (deps?.onReceiptPersist) {
        await deps.onReceiptPersist(result);
    } else {
        await admin
            .firestore()
            .collection('users')
            .doc(authenticatedUid)
            .collection('programmaticCampaignExecutions')
            .doc(result.directiveId)
            .set(result as unknown as Record<string, unknown>, { merge: true });
    }

    return result;
}

/**
 * Pure handler for ingesting and fanning out a `UnifiedAttributionEvent`.
 */
export async function handleIngestUnifiedAttributionEvent(
    authenticatedUid: string,
    rawPayload: unknown,
    deps?: {
        adapters?: ReadonlyArray<IAdPlatformAdapter>;
        dedupStore?: FirestoreAttributionDeduplicationStore;
    },
): Promise<AttributionFanOutReceipt> {
    const parsedEvent = UnifiedAttributionEventSchema.parse(rawPayload);
    const adapters =
        deps?.adapters ?? (await resolveArtistAdPlatformAdapters(authenticatedUid));
    const dedupStore =
        deps?.dedupStore ??
        new FirestoreAttributionDeduplicationStore({
            db: admin.firestore() as unknown as FirestoreLikeDb,
        });

    const bus = new AttributionBus(adapters, dedupStore);
    return bus.dispatch(parsedEvent);
}

export const executeUnifiedCampaignDirective = onCall(
    {
        enforceAppCheck: false,
        secrets: [typesafeApiKey],
        timeoutSeconds: 60,
        memory: '512MiB',
    },
    async (request: CallableRequest) => {
        validateAppCheckV2(request);

        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'Authentication required.');
        }

        try {
            const result = await handleExecuteUnifiedCampaignDirective(
                request.auth.uid,
                request.data,
            );
            return { ok: true, result };
        } catch (error) {
            if (error instanceof HttpsError) {
                throw error;
            }
            if (error instanceof ZodError) {
                throw new HttpsError(
                    'invalid-argument',
                    `Invalid UnifiedCampaignDirective payload: ${error.issues.map(i => i.message).join('; ')}`,
                );
            }
            const message = error instanceof Error ? error.message : String(error);
            logger.error('[executeUnifiedCampaignDirective] Execution failed', {
                uid: request.auth.uid,
                error: message,
            });
            throw new HttpsError('failed-precondition', message);
        }
    },
);

export const ingestUnifiedAttributionEvent = onCall(
    {
        enforceAppCheck: false,
        timeoutSeconds: 30,
        memory: '512MiB',
    },
    async (request: CallableRequest) => {
        validateAppCheckV2(request);

        if (!request.auth?.uid) {
            throw new HttpsError('unauthenticated', 'Authentication required.');
        }

        try {
            const receipt = await handleIngestUnifiedAttributionEvent(
                request.auth.uid,
                request.data,
            );
            return { ok: true, receipt };
        } catch (error) {
            if (error instanceof HttpsError) {
                throw error;
            }
            if (error instanceof ZodError) {
                throw new HttpsError(
                    'invalid-argument',
                    `Invalid UnifiedAttributionEvent payload: ${error.issues.map(i => i.message).join('; ')}`,
                );
            }
            const message = error instanceof Error ? error.message : String(error);
            logger.error('[ingestUnifiedAttributionEvent] Dispatch failed', {
                uid: request.auth.uid,
                error: message,
            });
            throw new HttpsError('internal', message);
        }
    },
);
