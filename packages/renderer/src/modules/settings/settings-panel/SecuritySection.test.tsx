import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecuritySection from './SecuritySection';
import { SubscriptionTier } from '@/services/subscription/SubscriptionTier';

const {
    showToast,
    getSubscription,
    getUsageStats,
    clearCache,
    storeState,
} = vi.hoisted(() => ({
    showToast: vi.fn(),
    getSubscription: vi.fn(),
    getUsageStats: vi.fn(),
    clearCache: vi.fn(),
    storeState: {
        logout: vi.fn(),
        user: { email: 'wiil@indii.music', emailVerified: true },
        userProfile: { id: 'owner-123', preferences: {} },
        updatePreferences: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: () => storeState,
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (selector: unknown) => selector,
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ showToast }),
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: { getSubscription, getUsageStats, clearCache },
}));

vi.mock('@/components/shared/PrivacySettingsPanel', () => ({
    PrivacySettingsPanel: () => <div>Privacy controls</div>,
}));

vi.mock('@/modules/settings/components/AuditLogDashboard', () => ({
    AuditLogDashboard: () => <div>Audit logs</div>,
}));

vi.mock('firebase/auth', () => ({
    getAuth: () => ({ currentUser: null }),
    sendEmailVerification: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const subscription = {
    id: 'sub-123',
    userId: 'owner-123',
    tier: SubscriptionTier.PRO_MONTHLY,
    status: 'active' as const,
    currentPeriodStart: new Date('2026-08-01T00:00:00Z').getTime(),
    currentPeriodEnd: new Date('2026-09-01T00:00:00Z').getTime(),
    cancelAtPeriodEnd: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
};

const usage = {
    userId: 'owner-123',
    tier: SubscriptionTier.PRO_MONTHLY,
    resetDate: new Date('2026-09-01T00:00:00Z').getTime(),
    imagesGenerated: 125,
    imagesRemaining: 375,
    imagesPerMonth: 500,
    videoDurationSeconds: 600,
    videoDurationMinutes: 10,
    videoRemainingMinutes: 20,
    videoTotalMinutes: 30,
    aiChatTokensUsed: 25000,
    aiChatTokensRemaining: 75000,
    aiChatTokensPerMonth: 100000,
    storageUsedGB: 5,
    storageRemainingGB: 45,
    storageTotalGB: 50,
    projectsCreated: 2,
    projectsRemaining: 23,
    maxProjects: 25,
    teamMembersUsed: 1,
    teamMembersRemaining: 4,
    maxTeamMembers: 5,
};

describe('SecuritySection plan and usage overview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSubscription.mockResolvedValue(subscription);
        getUsageStats.mockResolvedValue(usage);
    });

    it('shows verified plan, billing period, and usage values', async () => {
        render(<SecuritySection />);

        expect(await screen.findByText('indii Pro')).toBeInTheDocument();
        expect(screen.getByText('$19/month')).toBeInTheDocument();
        expect(screen.getByText(/Status: active/i)).toBeInTheDocument();
        expect(screen.getByText('125 of 500 used (25%)')).toBeInTheDocument();
        expect(screen.getByText('10 of 30 used (33%)')).toBeInTheDocument();
        expect(screen.getByText('25,000 of 100,000 used (25%)')).toBeInTheDocument();
        expect(screen.getByText(/processing quality; they do not change this subscription/i)).toBeInTheDocument();
    });

    it('fails closed instead of assuming a plan when subscription data cannot load', async () => {
        getSubscription.mockRejectedValueOnce(new Error('Billing service unavailable'));

        render(<SecuritySection />);

        expect(await screen.findByText('Plan details unavailable')).toBeInTheDocument();
        expect(screen.getByText('Billing service unavailable')).toBeInTheDocument();
        expect(screen.queryByText('indii Free')).not.toBeInTheDocument();
    });

    it('refreshes both plan and usage and gives visible sync feedback', async () => {
        render(<SecuritySection />);
        await screen.findByText('indii Pro');

        fireEvent.click(screen.getByRole('button', { name: 'Sync Plan & Usage' }));

        await waitFor(() => expect(getSubscription).toHaveBeenLastCalledWith('owner-123', true));
        expect(getUsageStats).toHaveBeenLastCalledWith('owner-123', true);
        expect(clearCache).toHaveBeenCalledWith('owner-123');
        expect(showToast).toHaveBeenCalledWith('Plan and usage synchronized', 'success');
    });
});
