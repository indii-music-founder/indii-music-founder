import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VideoNavbar from './VideoNavbar';

// Mock the store
vi.mock('../store/videoEditorStore', () => ({
    useVideoEditorStore: () => ({
        viewMode: 'director',
        setViewMode: vi.fn(),
    })
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Film: () => <svg data-testid="icon-film" />,
    Clapperboard: () => <svg data-testid="icon-clapperboard" />,
    Scissors: () => <svg data-testid="icon-scissors" />,
    MonitorPlay: () => <svg data-testid="icon-monitor-play" />,
    Loader2: () => <svg data-testid="icon-loader" />,
}));

// Mock ToastContext
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    })
}));

// Mock ScreenControl
vi.mock('@/services/screen/ScreenControlService', () => ({
    ScreenControl: {
        requestPermission: vi.fn(),
        openProjectorWindow: vi.fn(),
    }
}));

describe('VideoNavbar Accessibility', () => {
    it('should have accessible tab controls for view mode', () => {
        render(<VideoNavbar />);

        // Check for tablist
        const tabList = screen.getByRole('tablist', { name: /view mode/i });
        expect(tabList).toBeInTheDocument();

        // Check for tabs
        const directorTab = screen.getByRole('tab', { name: /director view/i });
        const editorTab = screen.getByRole('tab', { name: /editor view/i });

        expect(directorTab).toBeInTheDocument();
        expect(editorTab).toBeInTheDocument();

        // Check selected state (mock returns 'director')
        expect(directorTab).toHaveAttribute('aria-selected', 'true');
        expect(editorTab).toHaveAttribute('aria-selected', 'false');
    });
});
