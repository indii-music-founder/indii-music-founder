import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ ref: vi.fn((_storage, path) => path), upload: vi.fn(), get: vi.fn(), remove: vi.fn() }));
vi.mock('firebase/storage', () => ({ ref: mocks.ref, uploadString: mocks.upload, getBytes: mocks.get, deleteObject: mocks.remove }));
vi.mock('@/services/firebase', () => ({ storage: {} }));
import { deleteSessionAttachment, loadSessionAttachment, sessionAttachmentPath, uploadSessionAttachment, storeSessionAttachments, restoreSessionAttachments } from './SessionAttachmentStorage';

describe('session attachment storage boundary', () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.upload.mockResolvedValue({}); mocks.remove.mockResolvedValue(undefined); });
    it('uploads original bytes to a stable owner-scoped path and restores them', async () => {
        const stored = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: 'data:image/png;base64,AAEC' });
        expect(mocks.upload).toHaveBeenCalledWith(stored.storagePath, 'AAEC', 'base64', { contentType: 'image/png' });
        mocks.get.mockResolvedValue(new Uint8Array([0, 1, 2]).buffer);
        expect(await loadSessionAttachment('user', 'session', 'message', 0, stored)).toEqual({ mimeType: 'image/png', base64: 'AAEC' });
        await deleteSessionAttachment('user', 'session', 'message', 0, stored);
        expect(mocks.remove).toHaveBeenCalledWith(stored.storagePath);
    });
    it('round-trips binary data spanning multiple conversion chunks', async () => {
        const bytes = Uint8Array.from({ length: 20_000 }, (_, index) => index % 256);
        mocks.get.mockResolvedValue(bytes.buffer);
        const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
        const stored = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'application/pdf', base64: encoded });
        const restored = await loadSessionAttachment('user', 'session', 'message', 0, stored);
        const decoded = atob(restored.base64);
        expect(decoded.length).toBe(bytes.length);
        expect(Uint8Array.from(decoded, character => character.charCodeAt(0))).toEqual(bytes);
    });

    it('rejects changed stored bytes rather than displaying a corrupted attachment', async () => {
        const stored = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: 'AAEC' });
        mocks.get.mockResolvedValue(new Uint8Array([0, 1, 3]).buffer);
        await expect(loadSessionAttachment('user', 'session', 'message', 0, stored)).rejects.toThrow(/does not match/);
    });

    it('uses one content identity for equivalent base64 encodings', async () => {
        const first = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'text/plain', base64: 'YQ==' });
        const retry = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'text/plain', base64: 'YQ' });
        expect(retry.storagePath).toBe(first.storagePath);
    });

    it('preserves the original filename across storage and restore', async () => {
        const stored = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: 'AAEC', filename: 'cover.png' });
        mocks.get.mockResolvedValue(new Uint8Array([0, 1, 2]).buffer);
        expect(await loadSessionAttachment('user', 'session', 'message', 0, stored)).toEqual({ mimeType: 'image/png', base64: 'AAEC', filename: 'cover.png' });
    });

    it('uses the same path for identical retries and different paths for different content', async () => {
        const first = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: 'AAEC' });
        const retry = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: 'AAEC' });
        const changed = await uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: 'AAED' });
        expect(retry.storagePath).toBe(first.storagePath);
        expect(changed.storagePath).not.toBe(first.storagePath);
    });

    it('does not upload empty or mismatched attachment data', async () => {
        await expect(uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: '' })).rejects.toThrow(/empty/);
        await expect(uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: '  \n' })).rejects.toThrow(/empty/);
        await expect(uploadSessionAttachment('user', 'session', 'message', 0, { mimeType: 'image/png', base64: 'data:image/jpeg;base64,AAEC' })).rejects.toThrow(/content type/);
        expect(mocks.upload).not.toHaveBeenCalled();
    });
    it('restores mixed legacy and stored attachments without changing order', async () => {
        const stored = await storeSessionAttachments('user', 'session', 'message', [
            { mimeType: 'image/png', base64: 'AAEC' },
        ]);
        mocks.get.mockResolvedValue(new Uint8Array([0, 1, 2]).buffer);
        const second = { mimeType: 'text/plain', base64: 'aGk=' };
        const result = await restoreSessionAttachments('user', 'session', 'message', [stored[0]!, second]);
        expect(result).toEqual([{ mimeType: 'image/png', base64: 'AAEC' }, second]);
    });
    it('leaves prior uploaded objects intact if a later upload fails', async () => {
        mocks.upload.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('network unavailable'));
        await expect(storeSessionAttachments('user', 'session', 'message', [
            { mimeType: 'image/png', base64: 'AAEC' }, { mimeType: 'image/png', base64: 'AAEC' },
        ])).rejects.toThrow('network unavailable');
        expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('rejects paths belonging to another user or message', async () => {
        const attachment = { mimeType: 'image/png', storagePath: sessionAttachmentPath('other', 'session', 'message', 0, 'a'.repeat(64)) };
        await expect(loadSessionAttachment('user', 'session', 'message', 0, attachment)).rejects.toThrow(/does not match/);
        await expect(deleteSessionAttachment('user', 'session', 'message', 0, attachment)).rejects.toThrow(/does not match/);
        expect(mocks.get).not.toHaveBeenCalled();
        expect(mocks.remove).not.toHaveBeenCalled();
    });
});
