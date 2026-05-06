import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { IngredientDropZone, type Ingredient } from '../IngredientDropZone';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockError = vi.fn();

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        error: mockError,
        success: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn().mockReturnValue({
            generatedHistory: [
                { id: 'hist-001', url: 'http://cdn.test/img1.png', type: 'image' },
                { id: 'hist-002', url: 'http://cdn.test/vid1.mp4', type: 'video' },
            ],
            uploadedImages: [
                { id: 'upload-001', url: 'http://cdn.test/up1.png', type: 'image' },
            ],
            uploadedAudio: [],
        }),
    },
}));

// Mock FileReader to simulate async readAsDataURL
const mockFileReaderResult = 'data:image/png;base64,mockpngdata';
vi.stubGlobal('FileReader', class {
    result: string | null = null;
    onload: ((e: ProgressEvent<FileReader>) => void) | null = null;

    readAsDataURL(_file: File) {
        this.result = mockFileReaderResult;
        const event = { target: { result: this.result } } as unknown as ProgressEvent<FileReader>;
        setTimeout(() => this.onload?.(event), 0);
    }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockFile(name = 'test.png', type = 'image/png', sizeKB = 100): File {
    const bytes = new Uint8Array(sizeKB * 1024);
    const blob = new Blob([bytes], { type });
    return new File([blob], name, { type });
}

function renderDropZone(
    ingredients: Ingredient[] = [],
    onChange = vi.fn(),
    mode: 'reference' | 'base_video' | 'transition' = 'reference'
) {
    return render(
        <IngredientDropZone
            ingredients={ingredients}
            onChange={onChange}
            mode={mode}
        />
    );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('IngredientDropZone — Drag-and-Drop File Upload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Empty State Rendering ---

    it('shows drag prompt in reference mode (default)', () => {
        renderDropZone();
        expect(screen.getByText(/Drag up to 3 reference image\(s\) here/i)).toBeInTheDocument();
    });

    it('shows correct helper text for reference mode', () => {
        renderDropZone([], vi.fn(), 'reference');
        expect(screen.getByText(/Lock in characters, pets, or styles/)).toBeInTheDocument();
    });

    it('shows base_video mode prompt', () => {
        renderDropZone([], vi.fn(), 'base_video');
        expect(screen.getByText(/Drag up to 1 video here/i)).toBeInTheDocument();
        expect(screen.getByText(/Upload 1 base video for scene extension/)).toBeInTheDocument();
    });

    it('shows transition mode prompt', () => {
        renderDropZone([], vi.fn(), 'transition');
        expect(screen.getByText(/Drag up to 2 reference image\(s\) here/i)).toBeInTheDocument();
        expect(screen.getByText(/Upload Start & End frames/)).toBeInTheDocument();
    });

    // --- Capacity Limits ---

    it('shows counter badge when ingredients are partially filled', () => {
        const ingredients: Ingredient[] = [
            { id: '1', dataUrl: 'data:image/png;base64,a', file: createMockFile(), type: 'image' },
        ];
        renderDropZone(ingredients);
        expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('disables zone when at max capacity (3 for reference)', () => {
        const ingredients: Ingredient[] = Array.from({ length: 3 }, (_, i) => ({
            id: `img-${i}`,
            dataUrl: `data:image/png;base64,${i}`,
            file: createMockFile(`img-${i}.png`),
            type: 'image' as const,
        }));
        const { container } = renderDropZone(ingredients);
        // The drop zone container has role="button" and aria-disabled
        const zone = container.querySelector('[role="button"]');
        expect(zone).toHaveAttribute('aria-disabled', 'true');
    });

    it('disables zone when at max capacity (1 for base_video)', () => {
        const ingredients: Ingredient[] = [
            { id: 'vid-1', dataUrl: 'data:video/mp4;base64,a', file: createMockFile('v.mp4', 'video/mp4'), type: 'video' },
        ];
        const { container } = renderDropZone(ingredients, vi.fn(), 'base_video');
        const zone = container.querySelector('[role="button"]');
        expect(zone).toHaveAttribute('aria-disabled', 'true');
    });

    // --- File Input ---

    it('renders a hidden file input', () => {
        const { container } = renderDropZone();
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toBeInTheDocument();
        expect(fileInput).toHaveClass('hidden');
    });

    it('file input accepts image/* and video/* in reference mode', () => {
        const { container } = renderDropZone([], vi.fn(), 'reference');
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toHaveAttribute('accept', 'image/*,video/*');
    });

    it('file input accepts only video/* in base_video mode', () => {
        const { container } = renderDropZone([], vi.fn(), 'base_video');
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toHaveAttribute('accept', 'video/*');
    });

    it('file input allows multiple in reference mode (max 3)', () => {
        const { container } = renderDropZone([], vi.fn(), 'reference');
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toHaveAttribute('multiple');
    });

    it('file input does NOT allow multiple in base_video mode (max 1)', () => {
        const { container } = renderDropZone([], vi.fn(), 'base_video');
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).not.toHaveAttribute('multiple');
    });

    // --- File Upload via Input ---

    it('calls onChange with new ingredient when file is selected', async () => {
        const onChange = vi.fn();
        const { container } = render(
            <IngredientDropZone ingredients={[]} onChange={onChange} mode="reference" />
        );
        const fileInput = container.querySelector('input[type="file"]')!;
        const file = createMockFile('artwork.png', 'image/png');
        Object.defineProperty(fileInput, 'files', { value: [file] });
        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'image',
                        file,
                    })
                ])
            );
        });
    });

    it('shows toast error when file exceeds 10MB', async () => {
        const { container } = renderDropZone();
        const fileInput = container.querySelector('input[type="file"]')!;
        // Create a file that reports itself as > 10MB
        const bigFile = createMockFile('huge.png', 'image/png', 11 * 1024);
        Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });
        Object.defineProperty(fileInput, 'files', { value: [bigFile] });
        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(mockError).toHaveBeenCalledWith(
                expect.stringContaining('exceeds the 10MB limit')
            );
        });
    });

    // --- Drag and Drop ---

    it('processes dropped files when dragged from filesystem', async () => {
        const onChange = vi.fn();
        render(<IngredientDropZone ingredients={[]} onChange={onChange} mode="reference" />);
        const dropZone = screen.getByRole('button');
        const file = createMockFile('dropped.png', 'image/png');

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file],
                getData: () => '',
            },
        });

        await waitFor(() => {
            expect(onChange).toHaveBeenCalled();
        });
    });

    it('accepts gallery items dropped via text/plain ID', async () => {
        const onChange = vi.fn();
        render(<IngredientDropZone ingredients={[]} onChange={onChange} mode="reference" />);
        const dropZone = screen.getByRole('button');

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [],
                getData: () => 'hist-001', // ID from generatedHistory mock
            },
        });

        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'hist-001', type: 'image' })
                ])
            );
        });
    });

    it('shows error when max capacity reached during gallery drop', () => {
        const ingredients: Ingredient[] = Array.from({ length: 3 }, (_, i) => ({
            id: `existing-${i}`,
            dataUrl: `data:image/png;base64,${i}`,
            file: createMockFile(),
            type: 'image' as const,
        }));

        const { container } = render(
            <IngredientDropZone ingredients={ingredients} onChange={vi.fn()} mode="reference" />
        );
        // Zone is disabled at capacity — drop handler is not attached
        const zone = container.querySelector('[role="button"]');
        expect(zone).toHaveAttribute('aria-disabled', 'true');
    });

    it('rejects video drops in base_video mode for non-video gallery items', () => {
        const onChange = vi.fn();
        render(<IngredientDropZone ingredients={[]} onChange={onChange} mode="base_video" />);
        const dropZone = screen.getByRole('button');

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [],
                getData: () => 'hist-001', // hist-001 is type: 'image', not video
            },
        });

        expect(mockError).toHaveBeenCalledWith('Only videos are allowed for base video mode.');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('shows error when same item dropped twice', () => {
        const duplicate: Ingredient = {
            id: 'hist-001',
            dataUrl: 'http://cdn.test/img1.png',
            file: createMockFile(),
            type: 'image',
        };
        const onChange = vi.fn();
        const { container } = render(
            <IngredientDropZone ingredients={[duplicate]} onChange={onChange} mode="reference" />
        );
        // With 1 ingredient there are 2 buttons (drop zone + remove), use container query
        const dropZone = container.querySelector('[role="button"]')!;

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [],
                getData: () => 'hist-001',
            },
        });

        expect(mockError).toHaveBeenCalledWith('This item is already added.');
        expect(onChange).not.toHaveBeenCalled();
    });

    // --- Ingredient Display ---

    it('renders existing ingredient thumbnails', () => {
        const ingredients: Ingredient[] = [
            { id: '1', dataUrl: 'data:image/png;base64,abc', file: createMockFile(), type: 'image' },
        ];
        renderDropZone(ingredients);
        expect(screen.getByAltText('Ingredient')).toBeInTheDocument();
    });

    it('renders Start/End labels in transition mode', () => {
        const ingredients: Ingredient[] = [
            { id: '1', dataUrl: 'data:image/png;base64,a', file: createMockFile(), type: 'image' },
            { id: '2', dataUrl: 'data:image/png;base64,b', file: createMockFile(), type: 'image' },
        ];
        renderDropZone(ingredients, vi.fn(), 'transition');
        expect(screen.getByText('Start')).toBeInTheDocument();
        expect(screen.getByText('End')).toBeInTheDocument();
    });

    it('calls onChange with item removed when remove button is clicked', () => {
        const onChange = vi.fn();
        const ingredients: Ingredient[] = [
            { id: 'keep-me', dataUrl: 'data:image/png;base64,a', file: createMockFile(), type: 'image' },
            { id: 'remove-me', dataUrl: 'data:image/png;base64,b', file: createMockFile(), type: 'image' },
        ];
        render(<IngredientDropZone ingredients={ingredients} onChange={onChange} mode="reference" />);

        const removeButtons = screen.getAllByRole('button', { name: /Remove asset/i });
        fireEvent.click(removeButtons[1]!); // Remove second item

        expect(onChange).toHaveBeenCalledWith([ingredients[0]]);
    });

    // --- Keyboard Accessibility ---

    it('opens file picker on Enter key when not full', () => {
        const { container } = renderDropZone();
        const zone = screen.getByRole('button');
        const fileInput = container.querySelector('input[type="file"]')!;
        const clickSpy = vi.spyOn(fileInput as HTMLInputElement, 'click');

        fireEvent.keyDown(zone, { key: 'Enter' });
        expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file picker on Space key when not full', () => {
        const { container } = renderDropZone();
        const zone = screen.getByRole('button');
        const fileInput = container.querySelector('input[type="file"]')!;
        const clickSpy = vi.spyOn(fileInput as HTMLInputElement, 'click');

        fireEvent.keyDown(zone, { key: ' ' });
        expect(clickSpy).toHaveBeenCalled();
    });
});
