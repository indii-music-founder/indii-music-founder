import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    editImage: vi.fn()
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: { editImage: mocks.editImage }
}));

import { EditImageWithAnnotationsTool } from './EditImageWithAnnotationsTool';

const annotationArgs = {
    imageId: 'source-1',
    annotations: [{ color: 'red', cx: 10, cy: 20, r: 8 }],
    colorPrompts: { red: 'make this region blue' }
};

describe('EditImageWithAnnotationsTool', () => {
    beforeEach(() => {
        mocks.editImage.mockResolvedValue({ id: 'edited-1', url: 'data:image/png;base64,edited' });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('passes a source data URI and spatial prompt to the live editing service', async () => {
        const result = await EditImageWithAnnotationsTool.execute({
            ...annotationArgs,
            imageData: 'data:image/png;base64,AQID',
            maskData: 'data:image/png;base64,bWFzaw=='
        });

        expect(mocks.editImage).toHaveBeenCalledWith(expect.objectContaining({
            image: { mimeType: 'image/png', data: 'AQID' },
            mask: { mimeType: 'image/png', data: 'bWFzaw==' },
            model: 'pro',
            forceHighFidelity: true,
            prompt: expect.stringContaining('red circle at (10, 20) radius 8: make this region blue')
        }));
        expect(result).toEqual(expect.objectContaining({
            success: true,
            editedImageId: 'edited-1',
            urls: ['data:image/png;base64,edited']
        }));
    });

    it('loads an HTTPS image and converts it to base64 before editing', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            new Uint8Array([1, 2, 3]),
            { status: 200, headers: { 'content-type': 'image/png; charset=binary' } }
        ));
        vi.stubGlobal('fetch', fetchMock);

        const result = await EditImageWithAnnotationsTool.execute({
            ...annotationArgs,
            imageUrl: 'https://cdn.example.com/source.png'
        });

        expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/source.png', { credentials: 'omit' });
        expect(mocks.editImage).toHaveBeenCalledWith(expect.objectContaining({
            image: { mimeType: 'image/png', data: 'AQID' }
        }));
        expect(result.success).toBe(true);
    });

    it('rejects insecure remote image sources without calling the provider', async () => {
        const result = await EditImageWithAnnotationsTool.execute({
            ...annotationArgs,
            imageUrl: 'http://example.com/source.png'
        });

        expect(mocks.editImage).not.toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({
            toolError: 'Failed to edit image.',
            details: 'Remote annotation sources must use HTTPS.'
        }));
    });

    it('rejects empty annotation requests without loading or editing the image', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await EditImageWithAnnotationsTool.execute({
            ...annotationArgs,
            annotations: [],
            imageUrl: 'https://cdn.example.com/source.png'
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(mocks.editImage).not.toHaveBeenCalled();
        expect(result.details).toBe('At least one spatial annotation is required.');
    });
});
