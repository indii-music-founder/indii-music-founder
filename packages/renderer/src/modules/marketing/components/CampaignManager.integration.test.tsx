import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CampaignManager from './CampaignManager';
import { CampaignStatus, CampaignAsset } from '../types';
import '@testing-library/jest-dom'; // Import matchers

// Mock Context
const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
    ToastProvider: ({ children }: any) => <div>{children}</div>
}));

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('@/services/firebase', () => ({
    functions: { app: {} },
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() },
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => mockHttpsCallable)
}));

// Mock Campaign Data
const mockCampaign: CampaignAsset = {
    id: 'campaign-123',
    assetType: 'campaign',
    title: 'Test Campaign',
    durationDays: 30,
    startDate: '2024-01-01',
    status: CampaignStatus.PENDING,
    posts: [
        {
            id: 'post-1',
            platform: 'Twitter',
            copy: 'Hello World',
            imageAsset: {
                assetType: 'image',
                title: 'Image 1',
                imageUrl: 'http://example.com/image.jpg',
                caption: 'Caption'
            },
            day: 1,
            status: CampaignStatus.PENDING
        }
    ]
};

describe('CampaignManager structural callable boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Structural regression coverage only. This suite does not authenticate a
    // genuine user or prove a deployed social-delivery path.
    it('persists first, sends only the campaign ID, then applies the server-persisted queue result', async () => {
        const onUpdateCampaign = vi.fn(async () => undefined);
        const onSelectCampaign = vi.fn();
        const queuedPosts = mockCampaign.posts.map(post => ({
            ...post,
            status: CampaignStatus.EXECUTING,
            postId: 'queue-post-1',
            scheduledTime: '2026-08-10T12:00:00.000Z',
        }));

        mockHttpsCallable.mockResolvedValue({
            data: {
                success: true,
                message: 'Campaign queue confirmed.',
                posts: queuedPosts,
                status: CampaignStatus.EXECUTING,
            },
        });

        render(
            <CampaignManager
                campaigns={[mockCampaign]}
                selectedCampaign={mockCampaign}
                onSelectCampaign={onSelectCampaign}
                onUpdateCampaign={onUpdateCampaign}
                onCreateNew={vi.fn()}
            />
        );

        const executeBtn = screen.getByRole('button', { name: /execute/i });
        fireEvent.click(executeBtn);

        await waitFor(() => {
            expect(mockHttpsCallable).toHaveBeenCalledWith({
                campaignId: 'campaign-123',
                dryRun: false,
            });
            expect(mockToast.success).toHaveBeenCalledWith('Campaign queue confirmed.');
        }, { timeout: 10000 });

        expect(onUpdateCampaign).toHaveBeenCalledTimes(1);
        expect(onUpdateCampaign).toHaveBeenCalledWith(expect.objectContaining({ status: CampaignStatus.EXECUTING }));
        expect(onUpdateCampaign.mock.invocationCallOrder[0]).toBeLessThan(mockHttpsCallable.mock.invocationCallOrder[0]);
        expect(onSelectCampaign).toHaveBeenCalledWith(expect.objectContaining({
            status: CampaignStatus.EXECUTING,
            posts: expect.arrayContaining([expect.objectContaining({ postId: 'queue-post-1' })]),
        }));
    }, 15000);

    it('does not invoke the backend or report success when the pre-queue persistence write fails', async () => {
        const onUpdateCampaign = vi.fn().mockRejectedValue(new Error('Firestore denied'));

        render(
            <CampaignManager
                campaigns={[mockCampaign]}
                selectedCampaign={mockCampaign}
                onSelectCampaign={vi.fn()}
                onUpdateCampaign={onUpdateCampaign}
                onCreateNew={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /execute/i }));

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('was not queued'));
        });
        expect(mockHttpsCallable).not.toHaveBeenCalled();
        expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('persists a retryable failure and never reports success when the callable fails', async () => {
        const onUpdateCampaign = vi.fn(async () => undefined);

        mockHttpsCallable.mockRejectedValue(new Error('Validation Failed'));

        render(
            <CampaignManager
                campaigns={[mockCampaign]}
                selectedCampaign={mockCampaign}
                onSelectCampaign={vi.fn()}
                onUpdateCampaign={onUpdateCampaign}
                onCreateNew={vi.fn()}
            />
        );

        const executeBtn = screen.getByRole('button', { name: /execute/i });
        fireEvent.click(executeBtn);

        await waitFor(() => {
            expect(onUpdateCampaign).toHaveBeenCalledWith(expect.objectContaining({
                status: CampaignStatus.FAILED
            }));
            expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Validation Failed'));
        }, { timeout: 10000 });
        expect(onUpdateCampaign).toHaveBeenCalledTimes(2);
        expect(mockToast.success).not.toHaveBeenCalled();
    }, 15000);

    it('shows a terminal queue response as an error instead of success', async () => {
        const onSelectCampaign = vi.fn();
        mockHttpsCallable.mockResolvedValue({
            data: {
                success: true,
                message: 'Campaign delivery has terminal failures. Review the failed posts before retrying.',
                posts: [{ ...mockCampaign.posts[0], status: CampaignStatus.FAILED }],
                status: CampaignStatus.FAILED,
            },
        });

        render(
            <CampaignManager
                campaigns={[mockCampaign]}
                selectedCampaign={mockCampaign}
                onSelectCampaign={onSelectCampaign}
                onUpdateCampaign={vi.fn(async () => undefined)}
                onCreateNew={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /execute/i }));

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(expect.stringMatching(/terminal failures/i));
        });
        expect(mockToast.success).not.toHaveBeenCalled();
        expect(onSelectCampaign).toHaveBeenCalledWith(expect.objectContaining({
            status: CampaignStatus.FAILED,
        }));
    });

    it('reports both failures when the callable and failure-state persistence fail', async () => {
        const onUpdateCampaign = vi.fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('Firestore denied'));
        mockHttpsCallable.mockRejectedValue(new Error('Callable timed out'));

        render(
            <CampaignManager
                campaigns={[mockCampaign]}
                selectedCampaign={mockCampaign}
                onSelectCampaign={vi.fn()}
                onUpdateCampaign={onUpdateCampaign}
                onCreateNew={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /execute/i }));

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(expect.stringMatching(/could not be saved; refresh before retrying/i));
        });
        expect(onUpdateCampaign).toHaveBeenCalledTimes(2);
        expect(mockToast.success).not.toHaveBeenCalled();
    }, 15000);
});
