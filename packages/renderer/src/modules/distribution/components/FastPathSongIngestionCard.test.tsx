import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FastPathSongIngestionCard } from './FastPathSongIngestionCard';

describe('FastPathSongIngestionCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the empty upload dropzone prompt initially', () => {
        render(<FastPathSongIngestionCard artistName="indii founder" />);

        expect(screen.getByText('Fast-Path Song Ingestion')).toBeInTheDocument();
        expect(screen.getByText(/Drag & drop your master audio recording/i)).toBeInTheDocument();
        expect(screen.getByText(/automatic 44.1kHz \/ 24-bit validation/i)).toBeInTheDocument();
    });

    it('processes dropped audio master, cleans title, and displays Jev insight cards', async () => {
        const onCompleteMock = vi.fn();

        render(
            <FastPathSongIngestionCard
                artistName="Sarah Vance"
                onComplete={onCompleteMock}
            />
        );

        const fakeAudioFile = new File(['fake-audio-bytes'], 'Detroit_Midnight_master_v3_final_4416.wav', {
            type: 'audio/wav',
        });

        const dropzone = screen.getByText(/Drag & drop your master audio recording/i).closest('div');
        expect(dropzone).not.toBeNull();

        // Simulate file drop
        fireEvent.drop(dropzone!, {
            dataTransfer: {
                files: [fakeAudioFile],
            },
        });

        await waitFor(() => {
            // Title should be cleaned of DAW noise
            expect(screen.getByText('Detroit Midnight')).toBeInTheDocument();
        });

        // Verify Jev insight cards render
        expect(screen.getByText(/Listener Feed Viral Hook/i)).toBeInTheDocument();
        expect(screen.getByText(/DDEX Genre & Mood/i)).toBeInTheDocument();
        expect(screen.getByText(/Automated POD Merch Sync/i)).toBeInTheDocument();
        expect(screen.getByText(/Rights & Distribution Clearance/i)).toBeInTheDocument();

        expect(screen.getByText('Publish to Backstage & DSPs')).toBeInTheDocument();

        expect(onCompleteMock).toHaveBeenCalledTimes(1);
        const result = onCompleteMock.mock.calls[0]![0];
        expect(result.cleanedTitle).toBe('Detroit Midnight');
        expect(result.versionType).toBe('Original');
        expect(result.sampleRate).toBe(44100);
    });

    it('resets analysis when user clicks "Upload another master"', async () => {
        render(<FastPathSongIngestionCard artistName="Sarah Vance" />);

        const fakeAudioFile = new File(['fake-audio-bytes'], 'Summer_Reverie_Remix.mp3', {
            type: 'audio/mp3',
        });

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [fakeAudioFile] } });

        await waitFor(() => {
            expect(screen.getByText('Summer Reverie')).toBeInTheDocument();
        });

        const resetButton = screen.getByText('Upload another master');
        fireEvent.click(resetButton);

        await waitFor(() => {
            expect(screen.getByText(/Drag & drop your master audio recording/i)).toBeInTheDocument();
        });
    });
});
