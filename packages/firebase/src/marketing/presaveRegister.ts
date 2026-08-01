/**
 * presaveRegister — Persistent pre-save attribution
 *
 * Callable function that registers a fan's pre-save action and emits a
 * conversion event for attribution tracking. Deduplicates by
 * (userId, trackId, platform) — only the first pre-save per listener per song
 * per platform is counted.
 */

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { enqueueConversionEvent } from './conversionEventOutbox';
import type { ConversionEvent } from '@indii/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PresaveRegisterInput {
  trackId: string;
  platform: string;
  campaignId?: string;
}

export interface PresaveRegisterResult {
  leadId: string;
  campaignId: string;
  presaved: true;
}

export interface PresaveRegisterError {
  presaved: false;
  reason: 'MISSING_TRACK_ID' | 'MISSING_PLATFORM' | 'ALREADY_PRESAVED' | 'FIRESTORE_ERROR';
  message: string;
}

export type PresaveRegisterResponse = PresaveRegisterResult | PresaveRegisterError;

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateInput(input: unknown): input is PresaveRegisterInput {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return typeof obj.trackId === 'string' &&
    obj.trackId.length > 0 &&
    typeof obj.platform === 'string' &&
    obj.platform.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if a pre-save already exists for this (userId, trackId, platform) tuple.
 * Uses a compound query to avoid denormalization.
 */
async function checkPresaveExists(
  userId: string,
  trackId: string,
  platform: string,
): Promise<boolean> {
  const snapshot = await admin.firestore()
    .collectionGroup('leads')
    .where('userId', '==', userId)
    .where('trackId', '==', trackId)
    .where('platform', '==', platform)
    .limit(1)
    .get();
  return !snapshot.empty;
}

/**
 * Registers a pre-save and emits a conversion event.
 * Returns { presaved: true, leadId, campaignId } on success.
 * Returns { presaved: false, reason, message } on failure.
 *
 * Exported for testing.
 */
export async function registerPresave(
  userId: string,
  trackId: string,
  platform: string,
  campaignId: string,
): Promise<PresaveRegisterResponse> {
  try {
    // Dedup check: if already presaved, return early
    if (await checkPresaveExists(userId, trackId, platform)) {
      return {
        presaved: false,
        reason: 'ALREADY_PRESAVED',
        message: `User ${userId} has already pre-saved track ${trackId} on ${platform}.`,
      };
    }

    // Get or create the campaign doc if campaignId is provided
    let cid = campaignId;
    if (!cid) {
      const campaignsRef = admin.firestore()
        .collection('presaveCampaigns');
      const newDoc = await campaignsRef.add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        leadCount: 0,
      });
      cid = newDoc.id;
    }

    // Write the lead document
    const leadsRef = admin.firestore()
      .collection('presaveCampaigns')
      .doc(cid)
      .collection('leads');

    const leadId = leadsRef.doc().id;
    const now = new Date().toISOString();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await leadsRef.doc(leadId).set({
      userId,
      trackId,
      platform,
      presavedAt: timestamp,
      presavedAtISO: now,
    });

    // Increment lead count on the campaign
    await admin.firestore()
      .collection('presaveCampaigns')
      .doc(cid)
      .update({ leadCount: admin.firestore.FieldValue.increment(1) });

    // Emit conversion event
    const conversionEvent: ConversionEvent = {
      schemaVersion: 'conversion-event.v1',
      eventId: `presave:${userId}:${trackId}:${platform}:${leadId}`,
      artistId: userId,
      platform: 'presave',
      eventType: 'presave',
      occurredAt: now,
      revenueMinor: 0,
      costMinor: 0,
      currency: 'USD',
      campaignId: cid,
      adCreativeId: '',
      smartLinkSlug: '',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      metadata: {
        trackId,
        presavePlatform: platform,
        leadId,
      },
    };

    await enqueueConversionEvent(conversionEvent);

    logger.info('[presaveRegister] Pre-save registered', {
      userId,
      trackId,
      platform,
      campaignId: cid,
      leadId,
    });

    return {
      presaved: true,
      leadId,
      campaignId: cid,
    };
  } catch (error) {
    logger.error('[presaveRegister] Firestore error', {
      userId,
      trackId,
      platform,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      presaved: false,
      reason: 'FIRESTORE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown Firestore error',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Callable Function
// ─────────────────────────────────────────────────────────────────────────────

export const presaveRegister = onCall<PresaveRegisterInput, Promise<PresaveRegisterResponse>>(
  {
    region: 'us-central1',
    memory: '512MiB',
    enforceAppCheck: true,
    cors: ['https://indii.music', 'https://studio.indii.music'],
  },
  async (request) => {
    const { auth, data } = request;

    // Require authenticated user
    if (!auth?.uid) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to register a pre-save.',
      );
    }

    // Validate input
    if (!validateInput(data)) {
      throw new HttpsError(
        'invalid-argument',
        'Input must include trackId (string) and platform (string).',
      );
    }

    const { trackId, platform, campaignId } = data;

    if (!trackId || !platform) {
      return {
        presaved: false,
        reason: trackId ? 'MISSING_PLATFORM' : 'MISSING_TRACK_ID',
        message: `Missing required field: ${trackId ? 'platform' : 'trackId'}`,
      };
    }

    return registerPresave(auth.uid, trackId, platform, campaignId || '');
  },
);
