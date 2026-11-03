import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FastPathSongIngestionCard } from './FastPathSongIngestionCard';

const audioFile = new File(['audio bytes'], 'Detroit_Midnight_master_v3_final_4416.wav', { type: 'audio/wav' });

describe('FastPathSongIngestionCard', () => {
    it('shows an accessible file selector without claiming verification', () => {
        render(<FastPathSongIngestionCard artistName="Sarah Vance" />);

        expect(screen.getByRole('heading', { name: 'Song file preview' })).toBeInTheDocument();
        expect(screen.getByLabelText('Choose an audio file or drag it here')).toBeInTheDocument();
        expect(screen.queryByText(/ready for delivery/i)).not.toBeInTheDocument();
    });

    it('reports only filename and file properties from a selected file', () => {
        const onComplete = vi.fn();
        render(<FastPathSongIngestionCard artistName="Sarah Vance" onComplete={onComplete} />);

        fireEvent.change(screen.getByLabelText('Choose an audio file or drag it here'), { target: { files: [audioFile] } });

        expect(screen.getByRole('heading', { name: 'Detroit Midnight' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('distribution readiness have not been verified');
        expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
        expect(onComplete).toHaveBeenCalledWith({
            file: audioFile, cleanedTitle: 'Detroit Midnight', artistName: 'Sarah Vance', versionType: 'Original',
        });
    });

    it('accepts a dropped audio file and resets for another selection', () => {
        render(<FastPathSongIngestionCard />);
        fireEvent.drop(screen.getByText('Choose an audio file or drag it here').parentElement!, {
            dataTransfer: { files: [audioFile] },
        });
        expect(screen.getByRole('heading', { name: 'Detroit Midnight' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Choose another file' }));
        expect(screen.getByLabelText('Choose an audio file or drag it here')).toBeInTheDocument();
    });

    it('ignores non-audio files', () => {
        const onComplete = vi.fn();
        render(<FastPathSongIngestionCard onComplete={onComplete} />);
        fireEvent.change(screen.getByLabelText('Choose an audio file or drag it here'), {
            target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] },
        });
        expect(onComplete).not.toHaveBeenCalled();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
