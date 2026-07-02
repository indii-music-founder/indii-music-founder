import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuickCaptureView from './QuickCaptureView';

const { mockError } = vi.hoisted(() => ({
    mockError: vi.fn(),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: mockError,
        info: vi.fn(),
    }),
}));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    remoteRelayService: {
        dispatchTask: vi.fn(),
    },
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        uploadFile: vi.fn(),
    },
}));

vi.mock('../MobileRemote', () => ({
    triggerHaptic: vi.fn(),
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
        button: ({ children, whileTap, ...props }: React.PropsWithChildren<Record<string, unknown>> & { whileTap?: unknown }) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('QuickCaptureView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: undefined,
        });
    });

    it('shows an in-app unavailable message when geolocation is missing', () => {
        render(<QuickCaptureView isPaired={true} />);

        expect(screen.getByRole('button', { name: /pin n\/a/i })).toBeDisabled();
        expect(screen.getByText('Location capture is unavailable in this browser.')).toBeInTheDocument();
        expect(mockError).not.toHaveBeenCalled();
    });
});
