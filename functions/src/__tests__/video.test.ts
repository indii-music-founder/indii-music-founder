import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: vi.fn(() => ({
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                set: vi.fn(),
                get: vi.fn()
            }))
        })),
        FieldValue: {
            serverTimestamp: vi.fn()
        }
    })),
    storage: vi.fn(),
    auth: vi.fn()
}));

// Mock Inngest
vi.mock('inngest', () => {
    return {
        Inngest: vi.fn().mockImplementation(() => ({
            createFunction: vi.fn(),
            send: vi.fn()
        }))
    };
});

// Mock firebase-functions
vi.mock('firebase-functions/v1', () => ({
    runWith: vi.fn().mockReturnThis(),
    https: {
        onCall: vi.fn(),
        onRequest: vi.fn()
    }
}));

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: () => 'secret' }))
}));

vi.mock('@google-cloud/vertexai', () => ({
    VertexAI: vi.fn()
}));

describe('Video Backend', () => {
    it('should be testable', () => {
        expect(true).toBe(true);
    });

    it('should initialize firebase admin when module loads', async () => {
        // Dynamic import to trigger execution
        await import('../index');
        expect(admin.initializeApp).toHaveBeenCalled();
    });
});
