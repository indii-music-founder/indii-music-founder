import { describe, expect, it } from 'vitest';
import { imageDownloadFilename } from './downloadFilename';

describe('image download encoding names (pure logic)', () => {
    it('uses JPEG bytes even when the filename and MIME claim PNG', () => {
        expect(imageDownloadFilename('image-export-2d2d0afc.png', 'image/png', new Uint8Array([255, 216, 255, 224])))
            .toBe('image-export-2d2d0afc.jpg');
    });
    it('recognizes PNG and WebP signatures without MIME metadata', () => {
        expect(imageDownloadFilename('cover.jpg', '', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])))
            .toBe('cover.png');
        expect(imageDownloadFilename('cover.png', '', new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])))
            .toBe('cover.webp');
    });
    it('preserves matching JPEG names and stems containing dots', () => {
        expect(imageDownloadFilename('artist.cover.jpeg', 'image/jpeg')).toBe('artist.cover.jpeg');
        expect(imageDownloadFilename('artist.cover.png', 'IMAGE/JPEG; charset=binary')).toBe('artist.cover.jpg');
    });
    it('adds an image extension when no extension was supplied', () => {
        expect(imageDownloadFilename('cover', 'image/png')).toBe('cover.png');
    });
    it('leaves non-image and unknown downloads unchanged', () => {
        expect(imageDownloadFilename('teaser.mp4', 'video/mp4')).toBe('teaser.mp4');
        expect(imageDownloadFilename('notes.txt', 'text/plain', new Uint8Array([71, 73]))).toBe('notes.txt');
        expect(imageDownloadFilename('unknown.bin', '')).toBe('unknown.bin');
    });
});
