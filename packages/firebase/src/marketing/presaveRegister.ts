import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { buildConversionEventId, type ConversionEvent } from '@indii/shared';
import { arcjetKey } from '../config/secrets';
import { protectAnonymousSignupRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { enqueueConversionEvent } from './conversionEventOutbox';
import {
  PRE_SAVE_CAMPAIGNS_COLLECTION,
  PRE_SAVE_DSPS,
  parseStoredCampaign,
  type PreSaveDsp,
} from './presaveCampaigns';

export interface PresaveRegisterInput {
  campaignId: string;
  leadId: string;
  dsp: PreSaveDsp;
  email?: string;
  phone?: string;
  optInMarketing: boolean;
  fbclid?: string;
}

export interface PresaveRegisterResult {
  leadId: string;
  campaignId: string;
  presaved: true;
}

export interface PresaveRegisterError {
  presaved: false;
  reason: 'INVALID_INPUT' | 'CAMPAIGN_NOT_FOUND' | 'CAMPAIGN_UNAVAILABLE' | 'FIRESTORE_ERROR';
  message: string;
}

export type PresaveRegisterResponse = PresaveRegisterResult | PresaveRegisterError;

const inputSchema = z.object({
  campaignId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/),
  leadId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/),
  dsp: z.enum(PRE_SAVE_DSPS),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().min(5).max(32).optional(),
  optInMarketing: z.boolean(),
  fbclid: z.string().trim().max(512).optional(),
}).strict();

function registrationError(
  reason: PresaveRegisterError['reason'],
  message: string,
): PresaveRegisterError {
  return { presaved: false, reason, message };
}

export async function registerPresave(
  rawInput: unknown,
  dependencies: {
    firestore?: admin.firestore.Firestore;
    enqueue?: typeof enqueueConversionEvent;
  } = {},
): Promise<PresaveRegisterResponse> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return registrationError('INVALID_INPUT', 'Check the campaign form and try again.');
  }
  const input = parsed.data;
  const firestore = dependencies.firestore ?? admin.firestore();
  const enqueue = dependencies.enqueue ?? enqueueConversionEvent;
  const campaignRef = firestore.collection(PRE_SAVE_CAMPAIGNS_COLLECTION).doc(input.campaignId);
  const leadRef = campaignRef.collection('leads').doc(input.leadId);
  let ownerId = '';

  try {
    await firestore.runTransaction(async (transaction) => {
      const [campaignSnapshot, existingLead] = await Promise.all([
        transaction.get(campaignRef),
        transaction.get(leadRef),
      ]);
      if (!campaignSnapshot.exists) {
        throw new Error('PRESAVE_CAMPAIGN_NOT_FOUND');
      }
      const campaign = parseStoredCampaign(campaignSnapshot.data());
      if (!campaign || campaign.status !== 'active') {
        throw new Error('PRESAVE_CAMPAIGN_UNAVAILABLE');
      }
      ownerId = campaign.ownerId;
      if (!campaign.links[input.dsp]) {
        throw new Error('PRESAVE_DSP_UNAVAILABLE');
      }
      if (campaign.captureEmails && !input.email) {
        throw new Error('PRESAVE_EMAIL_REQUIRED');
      }
      if (campaign.capturePhones && !input.phone) {
        throw new Error('PRESAVE_PHONE_REQUIRED');
      }
      const capturesContact = Boolean(input.email || input.phone);
      if (capturesContact && !input.optInMarketing) {
        throw new Error('PRESAVE_CONSENT_REQUIRED');
      }
      if ((!campaign.captureEmails && input.email) || (!campaign.capturePhones && input.phone)) {
        throw new Error('PRESAVE_CONTACT_NOT_CONFIGURED');
      }

      transaction.set(leadRef, {
        leadId: input.leadId,
        campaignId: input.campaignId,
        ownerId,
        dsp: input.dsp,
        ...(input.email ? { email: input.email.toLowerCase() } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        optInMarketing: input.optInMarketing,
        ...(input.fbclid ? { fbclid: input.fbclid } : {}),
        collectedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: false });

      if (!existingLead.exists) {
        transaction.update(campaignRef, {
          leadCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    const occurredAt = new Date().toISOString();
    const conversionEvent: ConversionEvent = {
      schemaVersion: 'conversion-event.v1',
      eventId: buildConversionEventId({
        platform: 'presave',
        eventType: 'presave',
        sourceId: input.leadId,
      }),
      artistId: ownerId,
      platform: 'presave',
      eventType: 'presave',
      occurredAt,
      revenueMinor: 0,
      costMinor: 0,
      currency: 'USD',
      campaignId: input.campaignId,
      adCreativeId: '',
      smartLinkSlug: '',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      metadata: {
        presavePlatform: input.dsp,
        leadId: input.leadId,
      },
    };
    if (!await enqueue(conversionEvent)) {
      return registrationError('FIRESTORE_ERROR', 'Your pre-save could not be confirmed. Please try again.');
    }

    logger.info('[presaveRegister] Pre-save persisted', {
      campaignId: input.campaignId,
      leadId: input.leadId,
      dsp: input.dsp,
    });
    return { presaved: true, leadId: input.leadId, campaignId: input.campaignId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'PRESAVE_CAMPAIGN_NOT_FOUND') {
      return registrationError('CAMPAIGN_NOT_FOUND', 'This campaign is unavailable.');
    }
    if (message.startsWith('PRESAVE_')) {
      return registrationError('CAMPAIGN_UNAVAILABLE', 'Check the requested contact fields and try again.');
    }
    logger.error('[presaveRegister] Persistence failed', {
      campaignId: input.campaignId,
      leadId: input.leadId,
      error: message,
    });
    return registrationError('FIRESTORE_ERROR', 'Your pre-save could not be saved. Please try again.');
  }
}

export const presaveRegister = onCall<PresaveRegisterInput, Promise<PresaveRegisterResponse>>(
  {
    region: 'us-central1',
    memory: '512MiB',
    enforceAppCheck: true,
    secrets: [arcjetKey],
    cors: [
      'https://indii.music',
      'https://app.indii.music',
      'https://founder.indii.music',
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
    ],
  },
  async (request) => {
    validateAppCheckV2(request);
    const operationId = typeof request.data?.leadId === 'string'
      ? `presave-submit-${request.data.leadId.slice(0, 24)}`
      : 'presave-submit-invalid';
    const protection = await protectAnonymousSignupRequest(request.rawRequest, operationId);
    if (!protection.allowed) {
      if (protection.status === 429) throw new HttpsError('resource-exhausted', protection.message);
      if (protection.status === 503) throw new HttpsError('unavailable', protection.message);
      throw new HttpsError('permission-denied', protection.message);
    }
    return registerPresave(request.data);
  },
);
