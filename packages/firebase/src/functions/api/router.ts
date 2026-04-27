/**
 * APIRouter — REST API endpoint router
 *
 * Handles HTTP requests and routes them to appropriate handlers
 * All endpoints require authentication via Firebase ID token
 */

import { onRequest, Request, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { CreateTrack, CreateDistribution } from '@indiios/shared';
import type * as express from 'express';

const db = admin.firestore();

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
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

// GET /api/tracks/:id - Get track details
export const getTrack = onRequest(async (req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  try {
    if (req.method !== 'GET') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', requestId));
      return;
    }

    const userId = await verifyAuth(req);
    const trackId = req.path.split('/').pop();

    if (!trackId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing track ID', requestId));
      return;
    }

    const doc = await db.collection('users').doc(userId).collection('tracks').doc(trackId).get();
    if (!doc.exists) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Track not found', requestId));
      return;
    }

    res.status(200).json(respond(doc.data(), requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const trackData = req.body as CreateTrack;

    const trackId = db.collection('_').doc().id;
    const track = {
      id: trackId,
      ...trackData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userId).collection('tracks').doc(trackId).set(track);
    res.status(201).json(respond(track, requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const query = req.query as Record<string, unknown>;

    const limit = Math.min(Number(query.limit) || 100, 1000);
    const offset = Number(query.offset) || 0;

    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('events')
      .orderBy('timestamp', 'desc')
      .limit(limit + offset)
      .get();

    const events = snapshot.docs.slice(offset).map(d => d.data());
    res.status(200).json(respond(events, requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const trackId = req.path.split('/').pop();
    if (!trackId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing track ID', requestId));
      return;
    }

    const updateData = req.body;
    const updateWithTimestamp = { ...updateData, updatedAt: new Date().toISOString() };

    await db.collection('users').doc(userId).collection('tracks').doc(trackId).update(updateWithTimestamp);
    const updated = await db.collection('users').doc(userId).collection('tracks').doc(trackId).get();

    res.status(200).json(respond(updated.data(), requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const trackId = req.path.split('/').pop();
    if (!trackId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing track ID', requestId));
      return;
    }

    await db.collection('users').doc(userId).collection('tracks').doc(trackId).delete();
    res.status(204).send();
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const query = req.query as Record<string, unknown>;
    const limit = Math.min(Number(query.limit) || 50, 1000);
    const offset = Number(query.offset) || 0;

    const snapshot = await db
      .collection('users').doc(userId).collection('tracks')
      .orderBy('createdAt', 'desc')
      .limit(limit + offset)
      .get();

    const tracks = snapshot.docs.slice(offset).map(d => d.data());
    res.status(200).json(respond(tracks, requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const distData = req.body as CreateDistribution;

    const distId = db.collection('_').doc().id;
    const distribution = {
      id: distId,
      ...distData,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userId).collection('distributions').doc(distId).set(distribution);

    // Publish analytics event
    await db.collection('events').add({
      userId,
      eventType: 'distribution_started',
      distributionId: distId,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(respond(distribution, requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const distId = req.path.split('/').pop();
    if (!distId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing distribution ID', requestId));
      return;
    }

    const doc = await db.collection('users').doc(userId).collection('distributions').doc(distId).get();
    if (!doc.exists) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Distribution not found', requestId));
      return;
    }

    res.status(200).json(respond(doc.data(), requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const distId = req.path.split('/')[req.path.split('/').length - 2];
    if (!distId) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing distribution ID', requestId));
      return;
    }

    const ref = db.collection('users').doc(userId).collection('distributions').doc(distId);
    await ref.update({ status: 'submitted', updatedAt: new Date().toISOString() });
    const updated = await ref.get();

    res.status(200).json(respond(updated.data(), requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
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
    const userRecord = await admin.auth().getUser(userId);

    const profile = {
      id: userId,
      email: userRecord.email,
      name: userRecord.displayName || 'Unnamed User',
      createdAt: userRecord.metadata.creationTime,
    };

    res.status(200).json(respond(profile, requestId));
  } catch (err) {
    if (err instanceof HttpsError) {
      res.status(401).json(errorResponse('UNAUTHORIZED', err.message, requestId));
    } else {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', requestId));
    }
  }
});

// Health check endpoint (no auth required)
export const health = onRequest((_req: Request, res: express.Response) => {
  const requestId = generateRequestId();
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    timestamp: Date.now(),
    requestId,
  });
});
