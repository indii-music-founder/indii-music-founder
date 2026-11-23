import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GlobalDropZone } from './GlobalDropZone';

const store = vi.hoisted(() => ({
    addUploadedAudio: vi.fn(async () => true),
    addUploadedImage: vi.fn(async () => true),
    addKnowledgeDocument: vi.fn(),
    currentProjectId: 'project-1',
    addUploadItems: vi.fn(),
    updateUploadProgress: vi.fn(),
    updateUploadStatus: vi.fn(),
}));
vi.mock('@/core/store', () => ({ useStore: Object.assign(() => undefined, { getState: () => store }) }));
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

describe('GlobalDropZone (ISSUE-1693)', () => {
    it('reports the real read progress of a dropped file, ending at 100, then success', async () => {
        render(<GlobalDropZone><div /></GlobalDropZone>);
        const file = new File(['notes for the press kit'], 'notes.txt', { type: 'text/plain' });
        const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
        Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } });

        window.dispatchEvent(drop);

        await waitFor(() => expect(store.updateUploadStatus).toHaveBeenCalledWith(expect.any(String), 'success'));
        const progress = store.updateUploadProgress.mock.calls.map(([, value]) => value);
        expect(progress.at(-1)).toBe(100);
        expect(progress.every(value => value >= 0 && value <= 100)).toBe(true);
        expect(store.updateUploadStatus.mock.calls[0]?.[1]).toBe('uploading');
    });

    it('uploads dropped audio as the file itself (blob: URL), not a base64 copy', async () => {
        const createObjectURL = vi.fn(() => 'blob:https://app.indii.music/abc');
        Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
        store.updateUploadStatus.mockClear();
        render(<GlobalDropZone><div /></GlobalDropZone>);
        const file = new File(['RIFF....'], 'master.mp3', { type: 'audio/mpeg' });
        const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
        Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } });

        window.dispatchEvent(drop);

        await waitFor(() => expect(store.updateUploadStatus).toHaveBeenCalledWith(expect.any(String), 'success'));
        expect(createObjectURL).toHaveBeenCalledWith(file);
        expect(store.addUploadedAudio).toHaveBeenCalledWith(expect.objectContaining({ type: 'music', url: 'blob:https://app.indii.music/abc' }));
    });
});

