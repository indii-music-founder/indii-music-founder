import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '../../core/store';
import { useVideoEditorStore } from './store/videoEditorStore';
import { useToast } from '../../core/context/ToastContext';

// Mocks
vi.mock('../../core/store', () => ({
  useStore: vi.fn(),
}));

vi.mock('./store/videoEditorStore', () => ({
  useVideoEditorStore: vi.fn(),
}));

vi.mock('../../core/context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('../../core/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./components/VideoGenerationSidebar', () => ({
  VideoGenerationSidebar: () => <div>Sidebar</div>,
}));

vi.mock('./components/DirectorPromptBar', () => ({
  DirectorPromptBar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button onClick={onGenerate} data-testid="generate-btn">Generate</button>
  ),
}));

vi.mock('./components/DailiesStrip', () => ({
  DailiesStrip: () => <div>Dailies</div>,
}));

// Mock Firebase
const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();
const mockDb = {};

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('@/services/firebase', () => ({
  db: {},
}));

// Mock VideoGenerationService
const mockTriggerVideoGeneration = vi.fn();
vi.mock('@/services/image/VideoGenerationService', () => ({
  VideoGeneration: {
    triggerVideoGeneration: (...args: any[]) => mockTriggerVideoGeneration(...args),
  },
}));

describe('VideoWorkflow', () => {
  const mockSetJobId = vi.fn();
  const mockSetJobStatus = vi.fn();
  const mockAddToHistory = vi.fn();
  const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();

    (useStore as any).mockReturnValue({
      generatedHistory: [],
      selectedItem: null,
      pendingPrompt: null,
      setPendingPrompt: vi.fn(),
      addToHistory: mockAddToHistory,
      setPrompt: vi.fn(),
      studioControls: { resolution: '1080p' },
      videoInputs: {},
      setVideoInput: vi.fn(),
      currentOrganizationId: 'org-123',
    });

    // Mock functional update capability for setJobStatus
    const setJobStatusMock = vi.fn().mockImplementation((arg) => {
        if (typeof arg === 'function') {
            return arg('idle'); // Simulate current status is idle
        }
    });

    (useVideoEditorStore as any).mockReturnValue({
      jobId: null,
      status: 'idle',
      setJobId: mockSetJobId,
      setStatus: setJobStatusMock,
    });

    (useToast as any).mockReturnValue(mockToast);
  });

  it('triggers video generation and sets jobId', async () => {
    mockTriggerVideoGeneration.mockResolvedValue({ jobId: 'job-123' });

    render(<VideoWorkflow />);

    const generateBtn = screen.getByTestId('generate-btn');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockTriggerVideoGeneration).toHaveBeenCalled();
      expect(mockSetJobId).toHaveBeenCalledWith('job-123');
    });
  });

  it('listens to Firestore updates when jobId is present', async () => {
    // Setup store with a jobId to trigger the effect
    const setJobStatusMock = vi.fn().mockImplementation((arg) => {
        if (typeof arg === 'function') {
            return arg('queued'); // Simulate current status is queued
        }
    });

    (useVideoEditorStore as any).mockReturnValue({
      jobId: 'job-123',
      status: 'queued',
      setJobId: mockSetJobId,
      setStatus: setJobStatusMock,
    });

    // Mock onSnapshot to call the callback immediately
    mockOnSnapshot.mockImplementation((ref, callback) => {
        // Simulate a 'completed' update
        callback({
            exists: () => true,
            data: () => ({ status: 'completed', videoUrl: 'http://video.url', prompt: 'test prompt' })
        });
        return () => {}; // unsubscribe mock
    });

    render(<VideoWorkflow />);

    // Wait for dynamic imports and effect
    await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
    });

    // Verify history update
    expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
        id: 'job-123',
        url: 'http://video.url',
        type: 'video'
    }));

    // Verify success toast
    expect(mockToast.success).toHaveBeenCalledWith('Scene generated!');
  });
});
