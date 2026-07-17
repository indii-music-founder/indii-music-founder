import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import AutonomousLab from '../components/AutonomousLab';
import OmniWorkflow from '../video/OmniWorkflow';

// Mock the Zustand store
vi.mock('@/core/store', () => {
    return {
        useStore: vi.fn((selector) => {
            if (typeof selector === 'function') {
                return selector({
                    userProfile: { uid: 'tester' },
                    addToHistory: vi.fn(),
                    currentProjectId: 'project-123',
                    generatedHistory: [],
                    uploadedImages: [],
                    setViewMode: vi.fn(),
                    setVideoInputs: vi.fn(),
                    setStudioControls: vi.fn(),
                    studioControls: {},
                    setGenerationMode: vi.fn(),
                    handoffPayload: null,
                    setHandoffPayload: vi.fn(),
                });
            }
            return {
                userProfile: { uid: 'tester' },
                studioControls: {},
            };
        }),
        HistoryItem: {},
    };
});

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(),
    ref: vi.fn(),
    getDownloadURL: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'tester', getIdToken: vi.fn() } },
    functions: {},
    storage: {},
    remoteConfig: {},
}));

describe('QA Runtime Verification (NATIVE BYPASS)', () => {
    
    it('ISSUE-487: KEYFRAMES Sequence Architect UI renders without errors', () => {
        // Render the Sequence Architect (AutonomousLab) component
        render(<AutonomousLab />);
        
        // Verify it didn't crash and the correct UI is present
        expect(screen.getByText(/Sequence Architect/i)).toBeInTheDocument();
        expect(screen.getByText(/Establish Scene/i)).toBeInTheDocument();
    });

    it('ISSUE-493: OMNI REMIX UI renders without errors', () => {
        // Render the Omni Workflow component
        render(<OmniWorkflow />);
        
        // Verify it didn't crash and the key UI buttons/headers are present
        expect(screen.getByRole('button', { name: /Synthesize Omni Remix/i })).toBeInTheDocument();
    });

});
