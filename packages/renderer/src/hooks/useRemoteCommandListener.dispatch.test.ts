/**
 * ISSUE-983: "Save to Notes" clears media after queue acceptance without
 * verifying that any note was created. `saveCaptureNoteDirectly` is the fix —
 * deterministic capture types call the Notes tool directly and return a real
 * receipt, instead of asking an LLM to decide whether to call it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// The global test-setup mock of @/core/store (packages/renderer/src/test/setup.ts)
// is a fixed object without the notes slice. This suite exercises the real
// addNote/addAttachmentToNote behavior that save_media_note depends on.
vi.unmock('@/core/store');

const { saveCaptureNoteDirectly } = await import('./useRemoteCommandListener');
const { useStore } = await import('@/core/store');

describe('saveCaptureNoteDirectly', () => {
    beforeEach(() => {
        useStore.setState({ notes: [] });
    });

    it('saves a photo capture directly and returns a real noteId + assetUrl', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'media_capture',
            payload: { imageUrl: 'https://cdn.example/photo.jpg' },
        });

        expect(result).not.toBeNull();
        expect(result?.assetUrl).toBe('https://cdn.example/photo.jpg');
        expect(result?.noteId).toBeTruthy();
        expect(useStore.getState().notes.find(n => n.id === result?.noteId)?.attachments).toContain('https://cdn.example/photo.jpg');
    });

    it('saves a video capture directly', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'media_capture',
            payload: { videoUrl: 'https://cdn.example/video.mp4' },
        });

        expect(result?.assetUrl).toBe('https://cdn.example/video.mp4');
    });

    it('saves a document scan directly', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'document_scan',
            payload: { imageUrl: 'https://cdn.example/scan.jpg' },
        });

        expect(result?.assetUrl).toBe('https://cdn.example/scan.jpg');
    });

    it('saves a receipt log directly', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'receipt_log',
            payload: { imageUrl: 'https://cdn.example/receipt.jpg' },
        });

        expect(result?.assetUrl).toBe('https://cdn.example/receipt.jpg');
    });

    it('saves a plain voice memo (no transcription) directly', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'voice_memo',
            payload: { audioUrl: 'https://cdn.example/memo.webm' },
        });

        expect(result?.assetUrl).toBe('https://cdn.example/memo.webm');
    });

    it('returns null for a voice memo WITH a transcription — genuinely needs agent judgment', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'voice_memo',
            payload: { audioUrl: 'https://cdn.example/memo.webm', transcription: 'buy more strings' },
        });

        expect(result).toBeNull();
    });

    it('returns null for an explicit agent command — needs agent judgment', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'agent_command',
            payload: { commandText: 'generate a poster' },
        });

        expect(result).toBeNull();
    });

    it('returns null for a venue_log pin drop — needs a scout search, not a note', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'venue_log',
            payload: { lat: 42.3, lng: -83.0 },
        });

        expect(result).toBeNull();
    });

    it('returns null for live_moment (handled separately via addNote, not this helper)', async () => {
        const result = await saveCaptureNoteDirectly({
            type: 'live_moment',
            payload: { noteText: 'sound check at 8' },
        });

        expect(result).toBeNull();
    });
});
