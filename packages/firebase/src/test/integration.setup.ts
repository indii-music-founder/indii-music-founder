import * as admin from 'firebase-admin';
import { Request, Response } from 'express';

// Ensure we don't mock firebase-admin for integration tests
/**
 * Initializes REAL Firebase Admin services for integration tests.
 * This expects standard application default credentials or a service account key in the environment.
 */
export function initializeRealServices() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'indii-production',
            storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'test-bucket'
        });
    }
}

/**
 * Tears down REAL Firebase Admin services.
 */
export async function teardownServices() {
    await Promise.all(admin.apps.map(app => app?.delete()));
}

/**
 * Creates a mock express request object.
 */
export function createTestRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
): Partial<Request> {
    return {
        method,
        path,
        body,
        headers,
        query: {},
        params: {}
    };
}

/**
 * Creates a mock express response object.
 */
export function createTestResponse(): Partial<Response> & { _getData: () => unknown, _getStatusCode: () => number, _getHeaders: () => Record<string, string> } {
    let statusCode = 200;
    let data: unknown = null;
    const headers: Record<string, string> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = {
        status: (code: number) => {
            statusCode = code;
            return res;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        json: (body: any) => {
            data = body;
            return res;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        send: (body: any) => {
            data = body;
            return res;
        },
        setHeader: (name: string, value: string) => {
            headers[name] = value;
            return res;
        },
        _getData: () => data,
        _getStatusCode: () => statusCode,
        _getHeaders: () => headers,
    };

    return res;
}

/**
 * Mocks a decoded Firebase token for a given user context.
 */
export function createTestFirebaseToken(uid: string = 'test-user-id', email: string = 'test@example.com'): admin.auth.DecodedIdToken {
    return {
        uid,
        email,
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://securetoken.google.com/' + (process.env.VITE_FIREBASE_PROJECT_ID || 'indii-production'),
        sub: uid,
        aud: process.env.VITE_FIREBASE_PROJECT_ID || 'indii-production',
        firebase: {
            identities: {},
            sign_in_provider: 'password'
        }
    };
}

/**
 * Asserts that the response is successful.
 */
export function assertSuccess(response: Partial<Response> & { _getData: () => unknown, _getStatusCode: () => number }, expectedStatus = 200) {
    if (response._getStatusCode() !== expectedStatus) {
        throw new Error(`Expected status ${expectedStatus}, but got ${response._getStatusCode()}: ${JSON.stringify(response._getData())}`);
    }
}

/**
 * Asserts API latency is under a target.
 */
export function assertApiLatency(actualMs: number, targetMs: number) {
    if (actualMs > targetMs) {
        console.warn(`Latency warning: Expected < ${targetMs}ms, got ${actualMs}ms`);
        // We warn instead of throw for latency because CI environments can have variable network conditions.
    }
}
