import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShowroomService } from './ShowroomService';
import { Editing } from '@/services/image/EditingService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';

// Mock Firebase and Store
const mocks = vi.hoisted(() => ({
    addDoc: vi.fn(),
    collection: vi.fn(),
    updateDoc: vi.fn(),
    serverTimestamp: vi.fn(),
    useStore: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    addDoc: mocks.addDoc,
    collection: mocks.collection,
    updateDoc: mocks.updateDoc,
    serverTimestamp: mocks.serverTimestamp,
    getFirestore: vi.fn()
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user' }
        })
    }
}));

describe('ShowroomService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mocks
        mocks.addDoc.mockResolvedValue({ id: 'doc-1' });
    });

    it('should generate a mockup (simulated) and save to Firestore', async () => {
        const mockAsset = 'data:image/png;base64,mockdata';
        const mockPrompt = 'A cozy living room';

        const url = await ShowroomService.generateMockup(mockAsset, 'T-Shirt', mockPrompt);

        // Verify Firestore persistence
        expect(mocks.addDoc).toHaveBeenCalled();
        expect(url).toContain('https://images.unsplash.com'); // Mocked implementation returns Unsplash URL
    });

    it('should generate a video (simulated) and save to Firestore', async () => {
        const mockImage = 'https://mockup.url';
        const mockPrompt = 'Camera pans around';

        const url = await ShowroomService.generateVideo(mockImage, mockPrompt);

        expect(mocks.addDoc).toHaveBeenCalled();
        expect(url).toContain('giphy.gif'); // Mocked implementation returns Giphy URL
    });
});
