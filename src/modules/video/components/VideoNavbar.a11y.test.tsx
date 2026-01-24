import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoNavbar from './VideoNavbar';

// Mock the store
const mockSetViewMode = vi.fn();
vi.mock('../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(() => ({
        viewMode: 'director',
        setViewMode: mockSetViewMode,
    })),
}));

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
}));

// Mock ScreenControl
vi.mock('@/services/screen/ScreenControlService', () => ({
    ScreenControl: {
        requestPermission: vi.fn(),
        openProjectorWindow: vi.fn(),
    },
}));

import { useVideoEditorStore } from '../store/videoEditorStore';

describe('VideoNavbar Accessibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have a tablist for view mode switching', () => {
        render(<VideoNavbar />);
        const tablist = screen.getByRole('tablist', { name: /view mode/i });
        expect(tablist).toBeInTheDocument();
    });

    it('should have accessible tabs for Director and Editor modes', () => {
        render(<VideoNavbar />);

        const directorTab = screen.getByRole('tab', { name: /director/i });
        const editorTab = screen.getByRole('tab', { name: /editor/i });

        expect(directorTab).toBeInTheDocument();
        expect(editorTab).toBeInTheDocument();
    });

    it('should indicate the selected tab', () => {
        // Default mock is 'director'
        render(<VideoNavbar />);

        const directorTab = screen.getByRole('tab', { name: /director/i });
        const editorTab = screen.getByRole('tab', { name: /editor/i });

        expect(directorTab).toHaveAttribute('aria-selected', 'true');
        expect(editorTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should update aria-selected when view mode changes', () => {
        // Override mock to 'editor'
        (useVideoEditorStore as any).mockImplementation(() => ({
            viewMode: 'editor',
            setViewMode: mockSetViewMode,
        }));

        render(<VideoNavbar />);

        const directorTab = screen.getByRole('tab', { name: /director/i });
        const editorTab = screen.getByRole('tab', { name: /editor/i });

        expect(directorTab).toHaveAttribute('aria-selected', 'false');
        expect(editorTab).toHaveAttribute('aria-selected', 'true');
    });
});
