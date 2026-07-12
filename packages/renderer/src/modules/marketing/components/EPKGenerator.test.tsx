import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EPKGenerator from './EPKGenerator';

/**
 * ISSUE-945: handleDownloadHtml (formerly handleDownloadPDF) interpolated raw
 * artistName/bio/link values directly into an executable HTML file with no
 * escaping — a malicious bio/name could execute script or credential-phishing
 * markup when the downloaded EPK is opened. These tests capture the actual
 * Blob content and assert it is inert.
 */
describe('EPKGenerator — HTML export security', () => {
    let capturedBlob: Blob | null = null;

    beforeEach(() => {
        capturedBlob = null;
        window.URL.createObjectURL = vi.fn((blob: Blob) => {
            capturedBlob = blob;
            return 'blob:mock-url';
        });
        window.URL.revokeObjectURL = vi.fn();
        // jsdom doesn't implement real navigation on <a>.click() — avoid jsdom "not implemented" noise.
        HTMLAnchorElement.prototype.click = vi.fn();
    });

    function readBlobText(blob: Blob): Promise<string> {
        // jsdom's Blob polyfill doesn't implement .text() — use FileReader instead.
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(blob);
        });
    }

    async function generateAndDownload(): Promise<string> {
        fireEvent.click(screen.getByRole('button', { name: /generate epk/i }));
        // The component's simulated "generate" delay is a real 1.8s setTimeout — wait it out for real.
        const downloadBtn = await screen.findByRole('button', { name: /download html/i }, { timeout: 3000 });
        fireEvent.click(downloadBtn);
        expect(capturedBlob).not.toBeNull();
        return readBlobText(capturedBlob!);
    }

    it('escapes a script-tag artist name and bio so no executable markup survives', async () => {
        render(<EPKGenerator />);

        fireEvent.change(screen.getByPlaceholderText('Your Artist Name'), {
            target: { value: '<script>alert(document.cookie)</script>' },
        });
        const bioBox = document.querySelector('textarea')!;
        fireEvent.change(bioBox, {
            target: { value: '<img src=x onerror=alert(1)>Malicious bio' },
        });

        const html = await generateAndDownload();

        expect(html).not.toContain('<script>alert');
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('rejects a javascript: URL in a link field instead of embedding it as an href', async () => {
        render(<EPKGenerator />);

        const spotifyInput = screen.getByPlaceholderText('https://open.spotify.com/artist/...');
        fireEvent.change(spotifyInput, {
            target: { value: 'javascript:alert(document.domain)' },
        });

        const html = await generateAndDownload();

        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('>Spotify</a>');
    });

    it('rejects a data: URL in a link field', async () => {
        render(<EPKGenerator />);

        const spotifyInput = screen.getByPlaceholderText('https://open.spotify.com/artist/...');
        fireEvent.change(spotifyInput, {
            target: { value: 'data:text/html,<script>alert(1)</script>' },
        });

        const html = await generateAndDownload();

        expect(html).not.toContain('data:text/html');
    });

    it('keeps a legitimate https:// link functional', async () => {
        render(<EPKGenerator />);

        const spotifyInput = screen.getByPlaceholderText('https://open.spotify.com/artist/...');
        fireEvent.change(spotifyInput, {
            target: { value: 'https://open.spotify.com/artist/abc123' },
        });

        const html = await generateAndDownload();

        expect(html).toContain('href="https://open.spotify.com/artist/abc123"');
        expect(html).toContain('>Spotify</a>');
    });

    it('escapes quote characters so bio content cannot break out of an attribute context', async () => {
        render(<EPKGenerator />);

        fireEvent.change(screen.getByPlaceholderText('Your Artist Name'), {
            target: { value: '"><svg onload=alert(1)>' },
        });

        const html = await generateAndDownload();

        expect(html).not.toContain('"><svg onload=alert(1)>');
        expect(html).toContain('&quot;&gt;&lt;svg onload=alert(1)&gt;');
    });
});
