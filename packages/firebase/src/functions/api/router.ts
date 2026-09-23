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
