import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeysPanel } from '../KeysPanel';
import { distributionService } from '@/services/distribution/DistributionService';
import { isrcService } from '@/services/distribution/ISRCService';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: {
        checkMerlinStatus: vi.fn(),
        generateBWARM: vi.fn(),
    },
}));

vi.mock('@/services/distribution/ISRCService', () => ({
    isrcService: {
        getUserCatalog: vi.fn(),
    },
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-id' }
    },
    db: {},
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

describe('KeysPanel', () => {
    const mockCatalog = [
        {
            id: '1',
            isrc: 'US-XXX-24-00001',
            trackTitle: 'Test Track 1',
            artistName: 'Test Artist',
            releaseId: 'rel-1',
            createdAt: {},
            updatedAt: {},
            userId: 'user-1'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (isrcService.getUserCatalog as import("vitest").Mock).mockResolvedValue(mockCatalog);
    });

    it('should load catalog on mount', async () => {
        render(<KeysPanel />);

        await waitFor(() => {
            expect(isrcService.getUserCatalog).toHaveBeenCalled();
        });

        expect(screen.getByText(/Check compliance for 1 track/i)).toBeDefined();
    });

    it('should run Merlin compliance check', async () => {
        (distributionService.checkMerlinStatus as import("vitest").Mock).mockResolvedValue({
            status: 'READY',
            passed_count: 1,
            failed_count: 0,
            issues: []
        });

        render(<KeysPanel />);
        await waitFor(() => expect(screen.getByText(/Check compliance for 1 track/i)).toBeDefined());

        fireEvent.click(screen.getByText('Run Compliance Audit'));

        await waitFor(() => {
            expect(distributionService.checkMerlinStatus).toHaveBeenCalledWith(expect.objectContaining({
                catalog_id: expect.stringContaining('CAT-'),
                tracks: expect.arrayContaining([
                    expect.objectContaining({ isrc: 'US-XXX-24-00001' })
                ])
            }));
        });

        expect(screen.getByText('Status: READY')).toBeDefined();
    });

    it('should generate BWARM CSV', async () => {
        (distributionService.generateBWARM as import("vitest").Mock).mockResolvedValue('Header\nData');

        render(<KeysPanel />);
        await waitFor(() => expect(screen.getByText(/Check compliance for 1 track/i)).toBeDefined());

        fireEvent.click(screen.getByText('Generate BWARM CSV'));

        await waitFor(() => {
            expect(distributionService.generateBWARM).toHaveBeenCalledWith(expect.objectContaining({
                works: expect.arrayContaining([
                    expect.objectContaining({ isrc: 'US-XXX-24-00001', artist: 'Test Artist' })
                ])
            }));
        });

        expect(screen.getByText(/CSV Generated/i)).toBeDefined();
    });
});
