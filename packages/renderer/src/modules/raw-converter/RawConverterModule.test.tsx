import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RawConverterModule } from './RawConverterModule';

describe('RawConverterModule Component', () => {
    const mockInspect = vi.fn();
    const mockConvert = vi.fn();
    const mockSelectFile = vi.fn();
    const mockSelectDirectory = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (window as unknown as { electronAPI: unknown }).electronAPI = {
            raw: {
                inspect: mockInspect,
                convert: mockConvert,
                batchConvert: vi.fn(),
                cancel: vi.fn(),
                verify: vi.fn(),
                onProgress: vi.fn().mockReturnValue(() => {}),
            },
            system: {
                selectFile: mockSelectFile,
                selectDirectory: mockSelectDirectory,
            }
        };
    });

    it('renders the header with clean-room and zero-overwrite guarantee badges', () => {
        render(<RawConverterModule />);

        expect(screen.getByText('indii RAW Converter')).toBeInTheDocument();
        expect(screen.getByText('Clean-Room v1.0')).toBeInTheDocument();
        expect(screen.getByText(/Zero-Overwrite Guarantee/i)).toBeInTheDocument();
    });

    it('displays calibration settings including default +0.35 EV baseline exposure', () => {
        render(<RawConverterModule />);

        expect(screen.getByText('DNG Standards & Calibration Settings')).toBeInTheDocument();
        expect(screen.getByText('+0.35 EV')).toBeInTheDocument();
        expect(screen.getByText(/Lossless JPEG \(SOF3 2-Component, Recommended\)/i)).toBeInTheDocument();
    });

    it('adds files to queue and displays inspection metadata when files are chosen', async () => {
        mockSelectFile.mockResolvedValue(['/photos/DSC01234.ARW']);
        mockInspect.mockResolvedValue({
            filePath: '/photos/DSC01234.ARW',
            isSupported: true,
            format: 'Sony ARW',
            make: 'SONY',
            model: 'ILCE-7M3',
            width: 6048,
            height: 4024,
            activeArea: [0, 0, 4024, 6048],
            bitDepth: 14,
            cfa: { pattern: 'RGGB', repeatRows: 2, repeatCols: 2, blackLevel: 512, whiteLevel: 16383 },
            compression: 'cRAW',
            hasEmbeddedPreview: true,
            metadata: {
                make: 'SONY',
                model: 'ILCE-7M3',
                orientation: 1,
                baselineExposure: 0.35,
                asShotNeutral: [0.448, 1.0, 0.663],
            }
        });

        render(<RawConverterModule />);

        const selectBtn = screen.getByText('Select RAW Files');
        fireEvent.click(selectBtn);

        await waitFor(() => {
            expect(screen.getByText('DSC01234.ARW')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText(/SONY ILCE-7M3/i)).toBeInTheDocument();
            expect(screen.getByText(/6048x4024/i)).toBeInTheDocument();
            expect(screen.getByText(/14-bit RGGB/i)).toBeInTheDocument();
        });
    });

    it('triggers conversion and displays completion state', async () => {
        mockSelectFile.mockResolvedValue(['/photos/DSC01234.ARW']);
        mockInspect.mockResolvedValue({
            filePath: '/photos/DSC01234.ARW',
            isSupported: true,
            format: 'Sony ARW',
            make: 'SONY',
            model: 'ILCE-7M3',
            width: 6048,
            height: 4024,
            activeArea: [0, 0, 4024, 6048],
            bitDepth: 14,
            cfa: { pattern: 'RGGB', repeatRows: 2, repeatCols: 2, blackLevel: 512, whiteLevel: 16383 },
            compression: 'cRAW',
            hasEmbeddedPreview: true,
            metadata: {
                make: 'SONY',
                model: 'ILCE-7M3',
                orientation: 1,
                baselineExposure: 0.35,
                asShotNeutral: [0.448, 1.0, 0.663],
            }
        });

        mockConvert.mockResolvedValue({
            success: true,
            inputPath: '/photos/DSC01234.ARW',
            outputPath: '/photos/DSC01234.dng',
            inputSizeBytes: 24700000,
            outputSizeBytes: 23400000,
            compressionRatio: 0.947,
            durationMs: 420,
            cfaSampleHash: 'mock-hash-123',
            metadata: { make: 'SONY', model: 'ILCE-7M3', orientation: 1 }
        });

        render(<RawConverterModule />);

        fireEvent.click(screen.getByText('Select RAW Files'));

        await waitFor(() => {
            expect(screen.getByText(/Convert 1 Photo to DNG/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Convert 1 Photo to DNG/i));

        await waitFor(() => {
            expect(mockConvert).toHaveBeenCalledWith(expect.objectContaining({
                inputPath: '/photos/DSC01234.ARW',
                compressionMode: 'lossless-jpeg',
                embedOriginalRaw: false,
                baselineExposureOverride: 0.35,
            }));
        });

        await waitFor(() => {
            expect(screen.getByText('Converted')).toBeInTheDocument();
            expect(screen.getByText(/Verify Bit Losslessness/i)).toBeInTheDocument();
        });
    });
});
