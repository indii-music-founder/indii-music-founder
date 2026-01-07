
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useVideoEditorStore } from './store/videoEditorStore';

// --- Mocks ---

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        generatedHistory: [],
        selectedItem: null,
        pendingPrompt: null,
        setPendingPrompt: vi.fn(),
        addToHistory: vi.fn(),
        setPrompt: vi.fn(),
        studioControls: { resolution: '1080p' },
        videoInputs: {},
        currentOrganizationId: 'org-123',
    })),
}));

// Mock Video Editor Store
vi.mock('./store/videoEditorStore', () => {
    const fn = vi.fn();
    (fn as any).getState = vi.fn(() => ({ status: 'idle', setProgress: vi.fn() }));
    return { useVideoEditorStore: fn };
});

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock dependencies to prevent crash
vi.mock('../../utils/video', () => ({ extractVideoFrame: vi.fn() }));
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        subscribeToJob: vi.fn(() => () => {}), // Return unsubscribe fn
    },
}));
vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn(),
    collection: vi.fn(),
}));
vi.mock('@/services/firebase', () => ({ db: {} }));

// Helper to set store state for a test
const mockStoreState = (overrides: any) => {
    (useVideoEditorStore as any).mockReturnValue({
        jobId: overrides.jobId || null,
        status: overrides.status || 'idle',
        setJobId: vi.fn(),
        setStatus: vi.fn(),
        progress: overrides.progress || 0,
        setProgress: vi.fn(),
        viewMode: 'director',
        setViewMode: vi.fn(),
    });
    // Ensure getState matches if needed (though component uses hook)
    (useVideoEditorStore as any).getState.mockReturnValue({
        status: overrides.status || 'idle',
        setProgress: vi.fn()
    });
};

describe('VideoWorkflow UI States', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the "Director\'s Chair" empty state when idle', () => {
        mockStoreState({ status: 'idle' });
        render(<VideoWorkflow />);

        // Assert empty state text
        expect(screen.getByText(/Director's Chair/i)).toBeInTheDocument();
        expect(screen.getByText(/Compose your vision above to begin/i)).toBeInTheDocument();

        // Assert loading indicators are NOT present
        expect(screen.queryByText(/Imaginating Scene/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Stitching Masterpiece/i)).not.toBeInTheDocument();
    });

    it('renders the Loading Overlay when status is "processing"', () => {
        mockStoreState({ status: 'processing', progress: 45, jobId: 'job-123' });
        render(<VideoWorkflow />);

        // Assert loading text
        expect(screen.getByText(/Imaginating Scene.../i)).toBeInTheDocument();

        // Assert progress text
        expect(screen.getByText(/AI Director is rendering your vision \(45%\)/i)).toBeInTheDocument();

        // Assert presence of spinner (by class name logic or structure)
        // The component uses `animate-spin`. We can query by generic role or text,
        // but verifying the "Imaginating" text is the primary user feedback.
        // Let's check for the text which is dynamically rendered based on state.
    });

    it('renders the Stitching Overlay when status is "stitching"', () => {
        mockStoreState({ status: 'stitching', progress: 99, jobId: 'job-123' });
        render(<VideoWorkflow />);

        // Assert stitching text
        expect(screen.getByText(/Stitching Masterpiece.../i)).toBeInTheDocument();
        expect(screen.getByText(/Finalizing your unified video/i)).toBeInTheDocument();

        // Assert "Director's Chair" is covered or replaced (actually it's an overlay)
        // Since it's an overlay with absolute positioning, both might exist in DOM,
        // but the overlay should be visible.
    });

    it('renders the Queued Overlay when status is "queued"', () => {
        mockStoreState({ status: 'queued', jobId: 'job-123' });
        render(<VideoWorkflow />);

        // Should use the same "Imaginating" text or generic loading for queued
        // Logic: jobStatus === 'processing' || jobStatus === 'queued' ...
        expect(screen.getByText(/Imaginating Scene.../i)).toBeInTheDocument();
    });
});
