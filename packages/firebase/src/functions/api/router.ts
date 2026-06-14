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
  protectPublicApiRequest,
  type ArcjetProtectionResult,
} from '../security/arcjet';

// Defer firestore initialization until first use (for test compatibility)
function getDb() {
  return admin.firestore();
}

type CreateTrack = Record<string, unknown>;
type CreateDistribution = Record<string, unknown>;

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta: { timestamp: number; requestId: string; version: string };
}



// Middleware: Verify Firebase auth token
async function verifyAuth(req: Request): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Missing or invalid auth token');
  }

  const token = authHeader.slice(7);
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (_err) {
    throw new HttpsError('unauthenticated', 'Invalid token');
  }
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

function errorResponse(code: string, message: string, requestId: string): ApiResponse {
  return {
    success: false,
    error: { code, message },
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

  res.status(result.status).json(errorResponse(result.code, result.message, requestId));
  return true;
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
export const getTrack = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
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
export const createTrack = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedApiRequest(req, userId), res, requestId)) return;
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
export const queryAnalytics = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedApiRequest(req, userId), res, requestId)) return;
    const query = req.query as Record<string, unknown>;

    const limit = Math.min(Number(query.limit) || 100, 1000);
    const offset = Number(query.offset) || 0;

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
export const updateTrack = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'PUT') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
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
export const deleteTrack = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'DELETE') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
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
export const listTracks = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedApiRequest(req, userId), res, requestId)) return;
    const query = req.query as Record<string, unknown>;
    const limit = Math.min(Number(query.limit) || 50, 1000);
    const offset = Number(query.offset) || 0;

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
export const createDistribution = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedApiRequest(req, userId), res, requestId)) return;
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
export const getDistribution = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
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
export const submitDistribution = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'POST') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
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
export const getProfile = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
    if (await rejectIfArcjetDenied(protectAuthenticatedApiRequest(req, userId), res, requestId)) return;
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
export const health = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  if (await rejectIfArcjetDenied(protectPublicApiRequest(req), res, requestId)) return;

  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    timestamp: Date.now(),
    requestId,
  });
});
