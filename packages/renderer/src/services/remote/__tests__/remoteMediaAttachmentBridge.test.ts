import { describe, expect, it, vi, beforeEach } from 'vitest';
import { formatRemoteMediaReferences, resolveCommandAttachments } from '../rendererExecutionAdapter';
import { useStore } from '@/core/store';
import type { RemoteCommandAttachment } from '@/services/agent/RemoteRelayService';

describe('Remote Media Attachment Bridge (ISSUE-1528)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset uploadedImages in store
        useStore.setState({ uploadedImages: [] });
    });

    it('resolves remote command attachments and registers hosted URLs in store.uploadedImages', async () => {
        const mockAttachments: RemoteCommandAttachment[] = [
            {
                url: 'https://firebasestorage.googleapis.com/v0/b/indii.appspot.com/o/selfie.jpg?alt=media',
                mimeType: 'image/jpeg',
                name: 'selfie.jpg',
            },
        ];

        // Stub global fetch returning mock blob
        const mockBlob = new Blob(['mock-image-bytes'], { type: 'image/jpeg' });
        global.fetch = vi.fn().mockResolvedValue({
            blob: () => Promise.resolve(mockBlob),
        } as unknown as Response);

        // Mock FileReader in jsdom
        const originalFileReader = global.FileReader;
        class MockFileReader {
            onloadend: (() => void) | null = null;
            result: string | null = null;
            readAsDataURL() {
                this.result = 'data:image/jpeg;base64,bW9jay1pbWFnZS1ieXRlcw==';
                setTimeout(() => {
                    this.onloadend?.();
                }, 0);
            }
        }
        // @ts-expect-error Mocking FileReader
        global.FileReader = MockFileReader;

        try {
            const resolved = await resolveCommandAttachments(mockAttachments);

            expect(resolved).toHaveLength(1);
            expect(resolved[0]!.mimeType).toBe('image/jpeg');
            expect(resolved[0]!.url).toContain('https://firebasestorage.googleapis.com');
            expect(resolved[0]!.dataUrl).toContain('data:image/jpeg;base64');

            // Verify desktop store sync: uploadedImages must contain the image URL so agent tools can find it
            const currentUploaded = useStore.getState().uploadedImages.map(item =>
                typeof item === 'string' ? item : item.url
            );
            expect(currentUploaded).toContain('https://firebasestorage.googleapis.com/v0/b/indii.appspot.com/o/selfie.jpg?alt=media');
        } finally {
            global.FileReader = originalFileReader;
        }
    });

    it('preserves pre-existing base64 data URLs without network fetch', async () => {
        const mockAttachments: RemoteCommandAttachment[] = [
            {
                url: 'https://cdn.example.com/photo.png',
                mimeType: 'image/png',
                name: 'photo.png',
                base64: 'data:image/png;base64,cHJlLXJlc29sdmVk',
            },
        ];

        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;

        const resolved = await resolveCommandAttachments(mockAttachments);

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(resolved).toHaveLength(1);
        expect(resolved[0]!.dataUrl).toBe('data:image/png;base64,cHJlLXJlc29sdmVk');

        const currentUploaded = useStore.getState().uploadedImages.map(item =>
            typeof item === 'string' ? item : item.url
        );
        expect(currentUploaded).toContain('https://cdn.example.com/photo.png');
    });

    it('gracefully handles empty or non-image attachments', async () => {
        const resolvedEmpty = await resolveCommandAttachments([]);
        expect(resolvedEmpty).toEqual([]);

        const mockAudioAttachment: RemoteCommandAttachment[] = [
            {
                url: 'https://cdn.example.com/memo.m4a',
                mimeType: 'audio/mp4',
                name: 'memo.m4a',
            },
        ];

        const resolvedAudio = await resolveCommandAttachments(mockAudioAttachment);
        expect(resolvedAudio).toHaveLength(1);
        expect(resolvedAudio[0].mimeType).toBe('audio/mp4');
        expect(resolvedAudio[0].dataUrl).toBeUndefined();
    });

    it('passes an owned video Storage reference to agent text without claiming it was analyzed', () => {
        const url = 'https://firebasestorage.googleapis.com/v0/b/indii.appspot.com/o/users%2Fuser-1%2Fassets%2Fclip.mp4?alt=media&token=sample';
        const text = formatRemoteMediaReferences([{ url, mimeType: 'video/mp4', base64: '' }], 'user-1');
        expect(text).toContain(url);
        expect(text).toContain('not yet analyzed');
        expect(() => formatRemoteMediaReferences([{ url, mimeType: 'video/mp4', base64: '' }], 'user-2'))
            .toThrow(/not an owned Firebase Storage object/);
    });
});
