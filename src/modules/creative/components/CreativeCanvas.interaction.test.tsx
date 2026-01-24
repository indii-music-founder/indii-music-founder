import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreativeCanvas from './CreativeCanvas';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { canvasOps } from '../services/CanvasOperationsService';
import { Editing } from '@/services/image/EditingService';

// 🖱️ Click Persona: Multi-Click Daisychain Interaction
// Flow: Open Editor → Toggle Magic Fill → Set Color → Generate → Select → Close

vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn()
}));

vi.mock('../services/CanvasOperationsService', () => ({
    canvasOps: {
        initialize: vi.fn(),
        dispose: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(false),
        setMagicFillMode: vi.fn(),
        updateBrushColor: vi.fn(),
        prepareMasksForEdit: vi.fn(),
        applyCandidateImage: vi.fn(),
        saveCanvas: vi.fn(),
        getBlob: vi.fn(),
        toJSON: vi.fn()
    }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        multiMaskEdit: vi.fn()
    }
}));

describe('🖱️ Click: Creative Studio Daisychain', () => {
    const mockToast = {
        success: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warning: vi.fn()
    };

    const mockItem = {
        id: 'img-1',
        url: 'data:image/png;base64,mock',
        type: 'image',
        prompt: 'Original Prompt'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useToast as any).mockReturnValue(mockToast);
        (useStore as any).mockReturnValue({
            generatedHistory: [mockItem],
            setGenerationMode: vi.fn(),
            setViewMode: vi.fn(),
            addWhiskItem: vi.fn(),
            updateWhiskItem: vi.fn(),
            setPendingPrompt: vi.fn()
        });
    });

    it('executes a 6-click daisychain from Preview to Candidate Selection', async () => {
        const onClose = vi.fn();
        render(<CreativeCanvas item={mockItem as any} onClose={onClose} />);

        // --- STEP 1: Enter Editor ---
        const editBtn = screen.getByTestId('edit-canvas-btn');
        fireEvent.click(editBtn);
        expect(mockToast.success).toHaveBeenCalledWith('Editor mode active');

        // --- STEP 2: Toggle Magic Fill ---
        const magicToggle = screen.getByTestId('magic-fill-toggle');
        fireEvent.click(magicToggle);
        expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining('Annotating with Purple'));
        expect(canvasOps.setMagicFillMode).toHaveBeenCalledWith(true, expect.anything());

        // --- STEP 3: Input Interaction ---
        const magicInput = screen.getByTestId('magic-fill-input');
        fireEvent.change(magicInput, { target: { value: 'A friendly dragon' } });

        // --- STEP 4: Color Selection ---
        const orangeBtn = screen.getByTestId('color-btn-orange');
        fireEvent.click(orangeBtn);
        expect(canvasOps.updateBrushColor).toHaveBeenCalledWith(expect.objectContaining({ id: 'orange' }));

        // --- STEP 5: Generate ---
        // Setup mock response for generation
        vi.mocked(canvasOps.prepareMasksForEdit).mockReturnValue({ baseImage: { mimeType: 'image/png', data: 'mock' }, masks: [] });
        vi.mocked(Editing.multiMaskEdit).mockResolvedValue([
            { id: 'cand-1', url: 'candidate.jpg', prompt: 'Dragon variation' }
        ]);

        const genBtn = screen.getByTestId('magic-generate-btn');
        fireEvent.click(genBtn);

        expect(mockToast.info).toHaveBeenCalledWith('Processing Studio Edits...');

        // Wait for carousel to appear
        await waitFor(() => {
            expect(screen.getByTestId('candidate-select-btn-0')).toBeInTheDocument();
        });

        // --- STEP 6: Apply Selection ---
        const candBtn = screen.getByTestId('candidate-select-btn-0');
        fireEvent.click(candBtn);

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Applied Option 1'));
        }, { timeout: 2000 });

        expect(canvasOps.applyCandidateImage).toHaveBeenCalledWith(
            'candidate.jpg',
            true,
            expect.objectContaining({ id: 'orange' })
        );

        // --- Step 7: Close ---
        const closeBtn = screen.getByTestId('canvas-close-btn');
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
    });
});
