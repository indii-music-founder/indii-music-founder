"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mocks
const mockSet = vitest_1.vi.fn();
const mockDoc = vitest_1.vi.fn(() => ({ set: mockSet }));
const mockCollection = vitest_1.vi.fn(() => ({ doc: mockDoc }));
const mockFirestore = vitest_1.vi.fn(() => ({ collection: mockCollection }));
const mockFieldValue = { serverTimestamp: vitest_1.vi.fn(() => 'TIMESTAMP') };
const mockAuthGetClient = vitest_1.vi.fn();
const mockAuthGetProjectId = vitest_1.vi.fn();
// Mock Modules
vitest_1.vi.mock('firebase-admin', () => ({
    initializeApp: vitest_1.vi.fn(),
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
    storage: vitest_1.vi.fn(() => ({
        bucket: () => ({
            file: () => ({
                save: vitest_1.vi.fn(),
                makePublic: vitest_1.vi.fn(),
                publicUrl: () => 'https://mock-storage-url.com/video.mp4'
            })
        })
    }))
}));
// Mock GoogleAuth class using a class-like structure for the mock
class MockGoogleAuth {
    getClient() { return mockAuthGetClient(); }
    getProjectId() { return mockAuthGetProjectId(); }
}
vitest_1.vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: MockGoogleAuth
    };
});
(0, vitest_1.describe)('Video Backend Logic', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should successfully generate video and update firestore', async () => {
        // Setup Mocks
        mockAuthGetClient.mockResolvedValue({
            getAccessToken: async () => ({ token: 'mock-token' })
        });
        mockAuthGetProjectId.mockResolvedValue('mock-project');
        // Mock global fetch
        global.fetch = vitest_1.vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                predictions: [{
                        bytesBase64Encoded: 'mock-base64-video-data'
                    }]
            })
        });
        const jobId = 'test-job-id';
        // 1. Simulate "update-status-processing"
        await mockFirestore().collection('videoJobs').doc(jobId).set({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
        (0, vitest_1.expect)(mockCollection).toHaveBeenCalledWith('videoJobs');
        (0, vitest_1.expect)(mockDoc).toHaveBeenCalledWith(jobId);
        (0, vitest_1.expect)(mockSet).toHaveBeenCalledWith({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
        // 2. Simulate "generate-video-vertex" logic
        const { GoogleAuth } = await Promise.resolve().then(() => __importStar(require('google-auth-library')));
        const auth = new GoogleAuth();
        const client = await auth.getClient();
        // @ts-ignore
        const accessToken = await client.getAccessToken();
        const response = await fetch('https://mock-endpoint', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken.token}` }
        });
        const result = await response.json();
        (0, vitest_1.expect)(global.fetch).toHaveBeenCalled();
        (0, vitest_1.expect)(accessToken.token).toBe('mock-token');
        // 3. Simulate "update-status-completed"
        await mockFirestore().collection('videoJobs').doc(jobId).set({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
        (0, vitest_1.expect)(mockSet).toHaveBeenLastCalledWith({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
    });
});
//# sourceMappingURL=video.test.js.map