import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from './MembershipService';
import * as firestore from 'firebase/firestore';

// Mock Firestore
vi.mock('firebase/firestore', () => ({
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    doc: vi.fn(),
    increment: vi.fn(),
    getFirestore: vi.fn(),
}));

// Mock Store for User ID
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user' },
            organizations: [{ id: 'personal', plan: 'free' }],
            currentOrganizationId: 'personal'
        })
    }
}));

// Mock Firebase Service
vi.mock('@/services/firebase', () => ({
    db: {}
}));

describe('Ledger\'s Cost Circuit Breaker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('activates the Kill Switch when Free Tier quota is breached', async () => {
        // LEDGER'S PHILOSOPHY: "An infinite loop is an infinite bill."
        // We verify that the system HALTS video generation exactly when the limit is reached.

        const LIMIT = 5; // Free tier limit for videos
        let currentUsage = 0;

        // Mock getDoc to return incrementing usage
        vi.mocked(firestore.getDoc).mockImplementation(async () => {
            return {
                exists: () => true,
                data: () => ({
                    videosGenerated: currentUsage,
                    date: new Date().toISOString().split('T')[0]
                })
            } as any;
        });

        // Loop 1: Run up to the limit
        for (let i = 0; i < LIMIT; i++) {
            const check = await MembershipService.checkQuota('video');

            // Ledger: "Verify the wallet allows the charge"
            expect(check.allowed).toBe(true);
            expect(check.maxAllowed).toBe(LIMIT);

            // Simulate the charge
            currentUsage++;
        }

        // The "Hard Limit" Check
        // Now we are at 5/5. The next check should fail.
        const breachCheck = await MembershipService.checkQuota('video');

        // Ledger: "Assert the system halts exactly when limit is breached"
        expect(breachCheck.allowed).toBe(false);
        expect(breachCheck.currentUsage).toBe(LIMIT);
        expect(breachCheck.maxAllowed).toBe(LIMIT);

        // Verify we can't spend more money
        // Mock usage exceeding limit
        currentUsage = 6;
        const overageCheck = await MembershipService.checkQuota('video');
        expect(overageCheck.allowed).toBe(false);
    });

    it('injects "Fake High Usage" metadata to test the Stop switch', async () => {
        // Mock usage to be effectively infinite/high
        const HIGH_USAGE = 999999;

        vi.mocked(firestore.getDoc).mockImplementation(async () => {
            return {
                exists: () => true,
                data: () => ({
                    videosGenerated: HIGH_USAGE,
                    date: new Date().toISOString().split('T')[0]
                })
            } as any;
        });

        const check = await MembershipService.checkQuota('video');

        // Ledger: "If the Agent can't explain the cost, the Agent can't spend the money."
        expect(check.allowed).toBe(false);
        expect(check.currentUsage).toBe(HIGH_USAGE);
    });
});
