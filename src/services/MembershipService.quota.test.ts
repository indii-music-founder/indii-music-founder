
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MembershipService } from './MembershipService';
import { getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    db: {}
}));

// Mock Firestore SDK
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => 'mock-doc-ref'),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    increment: vi.fn((n) => ({ _type: 'increment', value: n })),
    FieldValue: { serverTimestamp: vi.fn() }
}));

// Mock Store for User ID and Tier
const mockGetState = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('MembershipService (Ledger Checks)', () => {
    const MOCK_USER_ID = 'ledger-user-123';

    beforeEach(() => {
        vi.clearAllMocks();

        // Default Store State (Free Tier, Authenticated)
        mockGetState.mockReturnValue({
            userProfile: { id: MOCK_USER_ID },
            organizations: [{ id: 'org-1', plan: 'free' }],
            currentOrganizationId: 'org-1'
        });

        // Default: No usage recorded (New day)
        (getDoc as any).mockResolvedValue({
            exists: () => false,
            data: () => undefined
        });
    });

    describe('Circuit Breaker (Quota Enforcement)', () => {
        it('💸 allows generation when usage is below limit (Free Tier)', async () => {
            // Setup: Free tier allows 5 videos. User has 0.
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({
                    videosGenerated: 2, // 2/5
                    updatedAt: Date.now()
                })
            });

            const result = await MembershipService.checkQuota('video', 1);

            expect(result.allowed).toBe(true);
            expect(result.currentUsage).toBe(2);
            expect(result.maxAllowed).toBe(5);
        });

        it('💸 ACTIVATES STOP SWITCH when limit is reached (The "Hard Limit")', async () => {
            // Setup: Free tier limit is 5. User has 5.
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({
                    videosGenerated: 5, // 5/5
                    updatedAt: Date.now()
                })
            });

            const result = await MembershipService.checkQuota('video', 1);

            expect(result.allowed).toBe(false); // STOP!
            expect(result.currentUsage).toBe(5);
        });

        it('💸 blocks "High Cost" operations if they would exceed quota', async () => {
            // Setup: User has 4/5 usage. Tries to make 2 videos.
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({
                    videosGenerated: 4, // 4/5
                    updatedAt: Date.now()
                })
            });

            const result = await MembershipService.checkQuota('video', 2);

            // 4 + 2 = 6 > 5. Should be blocked.
            expect(result.allowed).toBe(false);
        });

        it('💸 respects Tier Upgrades (Pro Limit)', async () => {
            // Setup: Upgrade user to Pro (Limit: 50)
            mockGetState.mockReturnValue({
                userProfile: { id: MOCK_USER_ID },
                organizations: [{ id: 'org-1', plan: 'pro' }],
                currentOrganizationId: 'org-1'
            });

            // User has 10 videos (would block Free, but allows Pro)
            (getDoc as any).mockResolvedValue({
                exists: () => true,
                data: () => ({
                    videosGenerated: 10,
                    updatedAt: Date.now()
                })
            });

            const result = await MembershipService.checkQuota('video', 1);

            expect(result.allowed).toBe(true);
            expect(result.maxAllowed).toBe(50);
        });

        it('💸 handles Enterprise Unlimited logic', async () => {
             // Setup: Upgrade user to Enterprise (Limit: 500 or -1 for projects)
             mockGetState.mockReturnValue({
                userProfile: { id: MOCK_USER_ID },
                organizations: [{ id: 'org-1', plan: 'enterprise' }],
                currentOrganizationId: 'org-1'
            });

            const result = await MembershipService.checkQuota('projects', 1);

            expect(result.allowed).toBe(true);
            expect(result.maxAllowed).toBe(Infinity);
        });
    });

    describe('Wallet Logic (Usage Deductions)', () => {
        it('💸 initializes "Wallet" (Usage Doc) if missing', async () => {
            // Setup: Doc does not exist
            (getDoc as any).mockResolvedValue({
                exists: () => false
            });

            await MembershipService.incrementUsage(MOCK_USER_ID, 'video', 1);

            expect(setDoc).toHaveBeenCalledWith(
                'mock-doc-ref',
                expect.objectContaining({
                    videosGenerated: 1,
                    imagesGenerated: 0
                })
            );
        });

        it('💸 deducts credits (Increments Usage) correctly', async () => {
            // Setup: Doc exists
            (getDoc as any).mockResolvedValue({
                exists: () => true
            });

            await MembershipService.incrementUsage(MOCK_USER_ID, 'video', 1);

            expect(updateDoc).toHaveBeenCalledWith(
                'mock-doc-ref',
                expect.objectContaining({
                    videosGenerated: { _type: 'increment', value: 1 }
                })
            );
            // Verify we used the firestore increment function
            expect(increment).toHaveBeenCalledWith(1);
        });

        it('💸 tracks secondary costs (Video Seconds)', async () => {
             (getDoc as any).mockResolvedValue({
                exists: () => true
            });

            const duration = 120; // 2 minutes
            await MembershipService.incrementUsage(MOCK_USER_ID, 'video', 1, duration);

            expect(increment).toHaveBeenCalledWith(duration);
            expect(updateDoc).toHaveBeenCalledWith(
                'mock-doc-ref',
                expect.objectContaining({
                    videoSecondsGenerated: { _type: 'increment', value: duration }
                })
            );
        });
    });

    describe('Video Duration Gates', () => {
        it('💸 blocks "Free Tier" users from "Pro" duration jobs', async () => {
             // Free Limit: 8 mins (480s)
             const duration = 600; // 10 mins

             const result = await MembershipService.checkVideoDurationQuota(duration);

             expect(result.allowed).toBe(false);
             expect(result.maxDuration).toBe(480);
        });

        it('💸 allows "Pro" users to run longer jobs', async () => {
            mockGetState.mockReturnValue({
                userProfile: { id: MOCK_USER_ID },
                organizations: [{ id: 'org-1', plan: 'pro' }],
                currentOrganizationId: 'org-1'
            });

            // Pro Limit: 60 mins (3600s)
            const duration = 600; // 10 mins

            const result = await MembershipService.checkVideoDurationQuota(duration);

            expect(result.allowed).toBe(true);
            expect(result.maxDuration).toBe(3600);
       });
    });
});
