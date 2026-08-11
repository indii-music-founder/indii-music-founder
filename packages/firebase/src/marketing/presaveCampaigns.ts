import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { z } from 'zod';
import { arcjetKey } from '../config/secrets';
import { protectAnonymousSignupRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

export const PRE_SAVE_CAMPAIGNS_COLLECTION = 'presaveCampaigns';
export const PRE_SAVE_DSPS = ['spotify', 'appleMusic', 'amazonMusic'] as const;
export type PreSaveDsp = typeof PRE_SAVE_DSPS[number];

const publicOrigins = [
  'https://indii.music',
  'https://app.indii.music',
  'https://founder.indii.music',
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
];

function isValidHttpsUrl(value: string): boolean {
  if (value === '') return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const httpsUrlSchema = z.string()
  .trim()
  .max(2048)
  .refine(isValidHttpsUrl, 'URL must be valid and use HTTPS.');

const linksSchema = z.object({
  spotify: httpsUrlSchema.optional(),
  appleMusic: httpsUrlSchema.optional(),
  amazonMusic: httpsUrlSchema.optional(),
}).strict().refine(
  (links) => Object.values(links).some((value) => typeof value === 'string' && value.length > 0),
  'At least one DSP link is required.',
);

export const preSaveCampaignInputSchema = z.object({
  campaignId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/).optional(),
  title: z.string().trim().min(1).max(160),
  releaseDate: z.number().int().min(0).max(4_102_444_800_000),
  coverArtUrl: httpsUrlSchema.default(''),
  links: linksSchema,
  captureEmails: z.boolean(),
  capturePhones: z.boolean(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict();

export type PreSaveCampaignInput = z.infer<typeof preSaveCampaignInputSchema>;

export interface StoredPreSaveCampaign {
  ownerId: string;
  title: string;
  releaseDate: admin.firestore.Timestamp;
  coverArtUrl: string;
  links: Partial<Record<PreSaveDsp, string>>;
  captureEmails: boolean;
  capturePhones: boolean;
  themeColor: string;
  status: 'active' | 'expired';
  leadCount: number;
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
  updatedAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
}

export interface PublicPreSaveCampaign {
  id: string;
  title: string;
  releaseDate: number;
  coverArtUrl: string;
  links: Partial<Record<PreSaveDsp, string>>;
  captureEmails: boolean;
  capturePhones: boolean;
  themeColor: string;
  status: 'active';
}

export function isApprovedDspUrl(dsp: PreSaveDsp, rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    switch (dsp) {
      case 'spotify':
        return hostname === 'open.spotify.com' || hostname.endsWith('.spotify.com');
      case 'appleMusic':
        return hostname === 'music.apple.com';
      case 'amazonMusic':
        return hostname === 'music.amazon.com' || hostname.endsWith('.music.amazon.com');
    }
  } catch {
    return false;
  }
}

export function validateDspLinks(links: Partial<Record<PreSaveDsp, string>>): void {
  for (const dsp of PRE_SAVE_DSPS) {
    const url = links[dsp];
    if (url && !isApprovedDspUrl(dsp, url)) {
      throw new HttpsError('invalid-argument', `${dsp} must use its official HTTPS domain.`);
    }
  }
}

function timestampToMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function parseStoredCampaign(data: unknown): StoredPreSaveCampaign | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (
    typeof value.ownerId !== 'string' || value.ownerId.length < 1 || value.ownerId.length > 128 ||
    typeof value.title !== 'string' || value.title.length < 1 || value.title.length > 160 ||
    timestampToMillis(value.releaseDate) === null ||
    timestampToMillis(value.createdAt) === null ||
    timestampToMillis(value.updatedAt) === null ||
    typeof value.coverArtUrl !== 'string' || value.coverArtUrl.length > 2048 ||
    !value.links || typeof value.links !== 'object' || Array.isArray(value.links) ||
    typeof value.captureEmails !== 'boolean' ||
    typeof value.capturePhones !== 'boolean' ||
    typeof value.themeColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.themeColor) ||
    !['active', 'expired'].includes(String(value.status)) ||
    typeof value.leadCount !== 'number' || !Number.isInteger(value.leadCount) || value.leadCount < 0
  ) {
    return null;
  }

  const parsedLinks = linksSchema.safeParse(value.links);
  if (!parsedLinks.success) return null;
  try {
    validateDspLinks(parsedLinks.data);
  } catch {
    return null;
  }

  return value as unknown as StoredPreSaveCampaign;
}

export async function savePreSaveCampaign(
  ownerId: string,
  rawInput: unknown,
  firestore: admin.firestore.Firestore = admin.firestore(),
): Promise<string> {
  const parsed = preSaveCampaignInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Campaign data is invalid.');
  }
  validateDspLinks(parsed.data.links);

  const { campaignId, ...input } = parsed.data;
  const campaignRef = campaignId
    ? firestore.collection(PRE_SAVE_CAMPAIGNS_COLLECTION).doc(campaignId)
    : firestore.collection(PRE_SAVE_CAMPAIGNS_COLLECTION).doc();

  let createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp =
    admin.firestore.FieldValue.serverTimestamp();
  let leadCount = 0;
  if (campaignId) {
    const existing = await campaignRef.get();
    if (!existing.exists) throw new HttpsError('not-found', 'Campaign not found.');
    const existingCampaign = parseStoredCampaign(existing.data());
    if (!existingCampaign) throw new HttpsError('failed-precondition', 'Campaign data is invalid.');
    if (existingCampaign.ownerId !== ownerId) {
      throw new HttpsError('permission-denied', 'Campaign belongs to another account.');
    }
    createdAt = existingCampaign.createdAt;
    leadCount = existingCampaign.leadCount;
  }

  const record: StoredPreSaveCampaign = {
    ownerId,
    title: input.title,
    releaseDate: admin.firestore.Timestamp.fromMillis(input.releaseDate),
    coverArtUrl: input.coverArtUrl,
    links: input.links,
    captureEmails: input.captureEmails,
    capturePhones: input.capturePhones,
    themeColor: input.themeColor,
    status: 'active',
    leadCount,
    createdAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await campaignRef.set(record, { merge: false });
  return campaignRef.id;
}

export async function getPublicPreSaveCampaign(
  campaignId: string,
  firestore: admin.firestore.Firestore = admin.firestore(),
): Promise<PublicPreSaveCampaign> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(campaignId)) {
    throw new HttpsError('invalid-argument', 'Campaign ID is invalid.');
  }
  const snapshot = await firestore.collection(PRE_SAVE_CAMPAIGNS_COLLECTION).doc(campaignId).get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Campaign not found.');
  const campaign = parseStoredCampaign(snapshot.data());
  if (!campaign || campaign.status !== 'active') {
    throw new HttpsError('not-found', 'Campaign is unavailable.');
  }
  return {
    id: campaignId,
    title: campaign.title,
    releaseDate: campaign.releaseDate.toMillis(),
    coverArtUrl: campaign.coverArtUrl,
    links: campaign.links,
    captureEmails: campaign.captureEmails,
    capturePhones: campaign.capturePhones,
    themeColor: campaign.themeColor,
    status: 'active',
  };
}

function throwForProtection(result: Awaited<ReturnType<typeof protectAnonymousSignupRequest>>): void {
  if (result.allowed) return;
  if (result.status === 429) throw new HttpsError('resource-exhausted', result.message);
  if (result.status === 503) throw new HttpsError('unavailable', result.message);
  throw new HttpsError('permission-denied', result.message);
}

export const createPreSaveCampaign = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    enforceAppCheck: true,
    cors: publicOrigins,
  },
  async (request) => {
    validateAppCheckV2(request);
    const ownerId = request.auth?.uid;
    if (!ownerId) throw new HttpsError('unauthenticated', 'Sign in to publish a campaign.');

    const campaignId = await savePreSaveCampaign(ownerId, request.data);
    logger.info('[PreSaveCampaign] Campaign persisted', { ownerId, campaignId });
    return { campaignId };
  },
);

export const getPreSaveCampaign = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    enforceAppCheck: true,
    secrets: [arcjetKey],
    cors: publicOrigins,
  },
  async (request) => {
    validateAppCheckV2(request);
    const campaignId = typeof request.data?.campaignId === 'string' ? request.data.campaignId : '';
    const protection = await protectAnonymousSignupRequest(
      request.rawRequest,
      `presave-read-${campaignId.slice(0, 24) || 'invalid'}`,
      'allow-low-risk-read',
    );
    throwForProtection(protection);
    return getPublicPreSaveCampaign(campaignId);
  },
);

export async function listUserPreSaveCampaigns(
  ownerId: string,
  firestore: admin.firestore.Firestore = admin.firestore(),
): Promise<Array<PublicPreSaveCampaign & { leadCount: number; createdAt: number }>> {
  if (!ownerId || ownerId.length < 1 || ownerId.length > 128) {
    throw new HttpsError('invalid-argument', 'Owner ID is invalid.');
  }
  const snapshot = await firestore
    .collection(PRE_SAVE_CAMPAIGNS_COLLECTION)
    .where('ownerId', '==', ownerId)
    .get();

  const results: Array<PublicPreSaveCampaign & { leadCount: number; createdAt: number }> = [];
  for (const doc of snapshot.docs) {
    const campaign = parseStoredCampaign(doc.data());
    if (campaign && campaign.status === 'active') {
      const createdAtMillis = timestampToMillis(doc.data().createdAt) ?? Date.now();
      results.push({
        id: doc.id,
        title: campaign.title,
        releaseDate: campaign.releaseDate.toMillis(),
        coverArtUrl: campaign.coverArtUrl,
        links: campaign.links,
        captureEmails: campaign.captureEmails,
        capturePhones: campaign.capturePhones,
        themeColor: campaign.themeColor,
        status: 'active',
        leadCount: campaign.leadCount,
        createdAt: createdAtMillis,
      });
    }
  }
  return results.sort((a, b) => b.createdAt - a.createdAt);
}

export const listPreSaveCampaigns = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    enforceAppCheck: true,
    secrets: [arcjetKey],
    cors: publicOrigins,
  },
  async (request) => {
    validateAppCheckV2(request);
    const ownerId = request.auth?.uid;
    if (!ownerId) throw new HttpsError('unauthenticated', 'Sign in to list campaigns.');

    const protection = await protectAnonymousSignupRequest(
      request.rawRequest,
      `presave-list-${ownerId.slice(0, 24)}`,
      'allow-low-risk-read',
    );
    throwForProtection(protection);
    const campaigns = await listUserPreSaveCampaigns(ownerId);
    return { campaigns };
  },
);

