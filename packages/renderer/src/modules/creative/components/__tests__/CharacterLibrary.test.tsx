import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CharacterLibrary } from '../CharacterLibrary';

const mockUseStore = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: (...args: any[]) => mockUseStore(...args),
}));

const mockToast = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

function buildState(overrides: Record<string, unknown> = {}) {
    return {
        characterReferences: [],
        addCharacterReference: vi.fn(),
        removeCharacterReference: vi.fn(),
        updateCharacterReference: vi.fn(),
        currentProjectId: 'project-1',
        addUploadedImage: vi.fn(),
        generatedHistory: [],
        userProfile: {
            brandKit: {
                brandAssets: [],
                referenceImages: [],
            },
        },
        ...overrides,
    };
}

describe('CharacterLibrary', () => {
    let mockImageLoadMode = 'valid';
    let mockFileReaderResult = 'data:image/png;base64,valid-upload';

    beforeEach(() => {
        mockImageLoadMode = 'valid';
        mockFileReaderResult = 'data:image/png;base64,valid-upload';

        mockToast.error.mockReset();
        mockToast.success.mockReset();
        mockToast.info.mockReset();
        mockToast.warning.mockReset();

        mockUseStore.mockImplementation((selector: any) => selector(buildState()));

        global.FileReader = class {
            result: string | ArrayBuffer | null = null;
            onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
            onerror: (() => void) | null = null;

            readAsDataURL() {
                this.result = mockFileReaderResult;
                this.onload?.({
                    target: { result: mockFileReaderResult },
                } as ProgressEvent<FileReader>);
            }
        } as unknown as typeof FileReader;

        global.Image = class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 0;
            naturalHeight = 0;
            set src(value: string) {
                if (value.includes('broken')) {
                    this.onerror?.();
                    return;
                }

                if (mockImageLoadMode === 'lowres' || value.includes('lowres')) {
                    this.naturalWidth = 1024;
                    this.naturalHeight = 512;
                } else {
                    this.naturalWidth = 1280;
                    this.naturalHeight = 720;
                }

                this.onload?.();
            }
        } as unknown as typeof Image;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('accepts a valid Creative Director reference', async () => {
        const addCharacterReference = vi.fn();
        const addUploadedImage = vi.fn();
        const generatedHistory = [
            {
                id: 'generated-1',
                url: 'data:image/png;base64,valid-generated',
                prompt: 'Generated reference',
                type: 'image',
            },
        ];

        mockUseStore.mockImplementation((selector: any) =>
            selector(buildState({ addCharacterReference, addUploadedImage, generatedHistory }))
        );

        render(<CharacterLibrary />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Add Person/i }));
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId('generated-reference-0'));
        });

        await waitFor(() => {
            expect(addCharacterReference).toHaveBeenCalledOnce();
            expect(addUploadedImage).toHaveBeenCalledOnce();
            expect(mockToast.success).toHaveBeenCalledWith('Character reference added from Creative Director.');
        });
    });

    it('rejects low-resolution uploaded files', async () => {
        const addCharacterReference = vi.fn();
        const addUploadedImage = vi.fn();

        mockUseStore.mockImplementation((selector: any) =>
            selector(buildState({ addCharacterReference, addUploadedImage }))
        );

        render(<CharacterLibrary />);

        const input = screen.getByTestId('character-library-file-input') as HTMLInputElement;

        mockImageLoadMode = 'lowres';
        mockFileReaderResult = 'data:image/png;base64,lowres-upload';

        await act(async () => {
            fireEvent.change(input, {
                target: {
                    files: [new File(['x'], 'lowres.png', { type: 'image/png' })],
                },
            });
        });

        await waitFor(() => {
            expect(addCharacterReference).not.toHaveBeenCalled();
            expect(addUploadedImage).not.toHaveBeenCalled();
            expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Uploaded image resolution too low'));
        });
    });

    it('warns and rejects Brand HQ assets that cannot be measured', async () => {
        const addCharacterReference = vi.fn();
        const addUploadedImage = vi.fn();

        mockUseStore.mockImplementation((selector: any) =>
            selector(buildState({
                addCharacterReference,
                addUploadedImage,
                userProfile: {
                    brandKit: {
                        brandAssets: [
                            {
                                id: 'brand-1',
                                url: 'data:image/png;base64,broken-brand',
                                description: 'Broken Brand HQ asset',
                                category: 'headshot',
                            },
                        ],
                        referenceImages: [],
                    },
                },
            }))
        );

        render(<CharacterLibrary />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Add Person/i }));
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId('brand-asset-reference-0'));
        });

        await waitFor(() => {
            expect(addCharacterReference).not.toHaveBeenCalled();
            expect(addUploadedImage).not.toHaveBeenCalled();
            expect(mockToast.warning).toHaveBeenCalledWith(expect.stringContaining('Could not verify Brand HQ asset image resolution'));
        });
    });
});
