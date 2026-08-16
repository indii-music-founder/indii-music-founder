/**
 * APIRouter — REST API endpoint router
 *
 * Handles HTTP requests and routes them to appropriate handlers
 * All endpoints require authentication via Firebase ID token
 */

import { onRequest, Request, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type * as express from 'express';
import {
  protectAuthenticatedApiRequest,
  protectAnonymousSignupRequest,
  policyClassForServerEntitlement,
  type ArcjetProtectionResult,
} from '../security/arcjet';
import { arcjetKey } from '../../config/secrets';
import { requireVerifiedServerEntitlement } from '../auth/entitlements';

// Defer firestore initialization until first use (for test compatibility)
function getDb() {
  return admin.firestore();
}

type CreateTrack = Record<string, unknown>;
type CreateDistribution = Record<string, unknown>;

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; retryAfterSeconds?: number };
  meta: { timestamp: number; requestId: string; version: string };
}

interface AuthenticatedApiPrincipal {
  uid: string;
  arcjetPolicy: ReturnType<typeof policyClassForServerEntitlement>;
}

const arcjetProtectedRequestOptions = { secrets: [arcjetKey] };



// Middleware: Verify Firebase auth token
async function verifyAuth(req: Request): Promise<AuthenticatedApiPrincipal> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Missing or invalid auth token');
  }

  const token = authHeader.slice(7);
  let decodedToken: { uid: string; admin?: boolean };
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (_err) {
    throw new HttpsError('unauthenticated', 'Invalid token');
  }

  // Keep verified-email/entitlement failures distinct from token failures so
  // clients cannot mistake a denied account for an invalid authentication flow.
  const entitlement = await requireVerifiedServerEntitlement(decodedToken.uid);
  return {
    uid: decodedToken.uid,
    arcjetPolicy: policyClassForServerEntitlement({
      tier: entitlement.tier,
      isAdmin: decodedToken.admin === true,
    }),
  };
}

// Response helpers
function generateRequestId(): string {
  return `${Date.now()}-${crypto.randomUUID().split('-')[0]}`;
}

function respond<T>(data: T, requestId: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: { timestamp: Date.now(), requestId, version: '1.0.0' },
  };
}

function errorResponse(code: string, message: string, requestId: string, retryAfterSeconds?: number): ApiResponse {
  return {
    success: false,
    error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) },
    meta: { timestamp: Date.now(), requestId, version: '1.0.0' },
  };
}

async function rejectIfArcjetDenied(
  resultPromise: Promise<ArcjetProtectionResult>,
  res: express.Response,
  requestId: string,
): Promise<boolean> {
  const result = await resultPromise;
  if (result.allowed) return false;

  if (result.retryAfterSeconds) {
    res.set('Retry-After', String(result.retryAfterSeconds));
  }
  res.status(result.status).json(errorResponse(result.code, result.message, requestId, result.retryAfterSeconds));
  return true;
}

/** Adapts a server-verified principal to the Arcjet request contract. */
function protectAuthenticatedRequest(req: Request, principal: AuthenticatedApiPrincipal, operationId: string) {
  return protectAuthenticatedApiRequest(req, {
    userId: principal.uid,
    policy: principal.arcjetPolicy,
    operationId,
  });
}

// Extract last resource ID segment from path, ignoring trailing slashes
function extractResourceId(pathString: string): string | undefined {
  if (!pathString) return undefined;
  const segments = pathString.split('/').filter(Boolean);
  return segments.pop();
}

// Extract parent resource ID segment (e.g. extracts "123" from "/api/distributions/123/submit")
function extractParentResourceId(pathString: string, suffixSegment: string): string | undefined {
  if (!pathString) return undefined;
  const segments = pathString.split('/').filter(Boolean);
  const suffixIdx = segments.indexOf(suffixSegment);
  if (suffixIdx > 0) {
    return segments[suffixIdx - 1];
  }
  return undefined;
}

interface PaginationOptions {
  defaultLimit: number;
  maxLimit: number;
}

interface Pagination {
  limit: number;
  offset: number;
}

function readNonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function normalizePagination(query: Record<string, unknown>, options: PaginationOptions): Pagination {
  const limit = Math.min(readNonNegativeInteger(query.limit, options.defaultLimit), options.maxLimit);
  const offset = readNonNegativeInteger(query.offset, 0);
  return { limit, offset };
}

// Maps Firebase HttpsError status codes to standard HTTP status codes
function sendHttpErrorResponse(err: unknown, res: express.Response, requestId: string): void {
  if (err instanceof HttpsError) {
    let status = 500;
    let code = 'INTERNAL_ERROR';

    switch (err.code) {
      case 'invalid-argument':
        status = 400;
        code = 'INVALID_ARGUMENT';
        break;
      case 'unauthenticated':
        status = 401;
        code = 'UNAUTHENTICATED';
        break;
      case 'permission-denied':
        status = 403;
        code = 'PERMISSION_DENIED';
        break;
      case 'not-found':
        status = 404;
        code = 'NOT_FOUND';
        break;
      case 'already-exists':
        status = 409;
        code = 'ALREADY_EXISTS';
        break;
      case 'resource-exhausted':
        status = 429;
        code = 'RESOURCE_EXHAUSTED';
        break;
      case 'failed-precondition':
        status = 412;
        code = 'FAILED_PRECONDITION';
        break;
      case 'unimplemented':
        status = 501;
        code = 'UNIMPLEMENTED';
        break;
      case 'unavailable':
        status = 503;
        code = 'UNAVAILABLE';
        break;
    }
    res.status(status).json(errorResponse(code, err.message, requestId));
  } else {
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
  }
}

// GET /api/tracks/:id - Get track details
export const getTrack = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const trackId = extractResourceId(req.path);

    if (!trackId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing track ID', requestId));
      return;
    }

    const doc = await getDb().collection('users').doc(userId).collection('tracks').doc(trackId).get();
    if (!doc.exists) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Track not found', requestId));
      return;
    }

    res.status(200).json(respond(doc.data(), requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// POST /api/tracks - Create new track
export const createTrack = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const trackData = req.body as CreateTrack;

    const trackId = getDb().collection('_').doc().id;
    const track = {
      id: trackId,
      ...trackData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await getDb().collection('users').doc(userId).collection('tracks').doc(trackId).set(track);
    res.status(201).json(respond(track, requestId));
  } catch (err) {
    console.error("Router error:", err);
    sendHttpErrorResponse(err, res, requestId);
  }
});

// GET /api/analytics/events - Query analytics events
export const queryAnalytics = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const query = req.query as Record<string, unknown>;

    const { limit, offset } = normalizePagination(query, { defaultLimit: 100, maxLimit: 1000 });

    const snapshot = await getDb()
      .collection('users')
      .doc(userId)
      .collection('events')
      .orderBy('timestamp', 'desc')
      .limit(limit + offset)
      .get();

    const events = snapshot.docs.slice(offset).map(d => d.data());
    res.status(200).json(respond(events, requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// PUT /api/tracks/:id - Update track
export const updateTrack = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'PUT') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const trackId = extractResourceId(req.path);
    if (!trackId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing track ID', requestId));
      return;
    }

    const trackRef = getDb().collection('users').doc(userId).collection('tracks').doc(trackId);
    const existing = await trackRef.get();
    if (!existing.exists) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Track not found', requestId));
      return;
    }

    const updateData = req.body;
    // Strip immutable fields from body update to protect data integrity
    const { id, createdAt, updatedAt, userId: _, ...sanitizedUpdate } = updateData || {};
    const updateWithTimestamp = { ...sanitizedUpdate, updatedAt: new Date().toISOString() };

    await trackRef.update(updateWithTimestamp);
    const updated = await trackRef.get();

    res.status(200).json(respond(updated.data(), requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// DELETE /api/tracks/:id - Delete track
export const deleteTrack = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'DELETE') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const trackId = extractResourceId(req.path);
    if (!trackId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing track ID', requestId));
      return;
    }

    await getDb().collection('users').doc(userId).collection('tracks').doc(trackId).delete();
    res.status(204).send();
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// GET /api/tracks - List tracks with pagination
export const listTracks = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const query = req.query as Record<string, unknown>;
    const { limit, offset } = normalizePagination(query, { defaultLimit: 50, maxLimit: 1000 });

    const snapshot = await getDb()
      .collection('users').doc(userId).collection('tracks')
      .orderBy('createdAt', 'desc')
      .limit(limit + offset)
      .get();

    const tracks = snapshot.docs.slice(offset).map(d => d.data());
    res.status(200).json(respond(tracks, requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// POST /api/distributions - Create distribution
export const createDistribution = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const distData = req.body as CreateDistribution;

    const distId = getDb().collection('_').doc().id;
    const distribution = {
      id: distId,
      ...distData,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await getDb().collection('users').doc(userId).collection('distributions').doc(distId).set(distribution);

    // Publish analytics event
    await getDb().collection('events').add({
      userId,
      eventType: 'distribution_started',
      distributionId: distId,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(respond(distribution, requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// GET /api/distributions/:id - Get distribution details
export const getDistribution = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const distId = extractResourceId(req.path);
    if (!distId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing distribution ID', requestId));
      return;
    }

    const doc = await getDb().collection('users').doc(userId).collection('distributions').doc(distId).get();
    if (!doc.exists) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Distribution not found', requestId));
      return;
    }

    res.status(200).json(respond(doc.data(), requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// POST /api/distributions/:id/submit - Submit distribution
export const submitDistribution = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const distId = extractParentResourceId(req.path, 'submit');
    if (!distId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing distribution ID', requestId));
      return;
    }

    const ref = getDb().collection('users').doc(userId).collection('distributions').doc(distId);
    const existing = await ref.get();
    if (!existing.exists) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Distribution not found', requestId));
      return;
    }

    await ref.update({ status: 'submitted', updatedAt: new Date().toISOString() });
    const updated = await ref.get();

    res.status(200).json(respond(updated.data(), requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// GET /api/profile - Get user profile
export const getProfile = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const principal = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedRequest(req, principal, requestId), res, requestId)) return;
    const userId = principal.uid;
    const userRecord = await admin.auth().getUser(userId);

    const profile = {
      id: userId,
      email: userRecord.email,
      name: userRecord.displayName || 'Unnamed User',
      createdAt: userRecord.metadata.creationTime,
    };

    res.status(200).json(respond(profile, requestId));
  } catch (err) {
    sendHttpErrorResponse(err, res, requestId);
  }
});

// Health check endpoint (no auth required)
export const health = onRequest(arcjetProtectedRequestOptions, async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  if (req.method !== 'GET') {
    res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
    return;
  }
  if (await rejectIfArcjetDenied(protectAnonymousSignupRequest(req, requestId, 'allow-low-risk-read'), res, requestId)) return;

  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    timestamp: Date.now(),
    requestId,
  });
});
