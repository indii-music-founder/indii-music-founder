/**
 * Structural wiring tests for analyzeEncounterWithGemini with injected fakes.
 *
 * These prove the multi-asset part-assembly contract (labeled text part +
 * media part per asset, video metadata, byte caps, finishReason gating) and
 * that unsupported model output is rejected through the real wiring path.
 * They do NOT claim live media extraction works — per REAL_USER_AUTHENTICITY
 * that requires real captured audio/photo/video through the deployed pipeline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const generateContent = vi.fn();
    const getMetadata = vi.fn();
    const bucket = {
        name: 'proj',
        file: (path: string) => {
            mocks.lastPath = path;
            return { getMetadata };
        },
    };
    return { generateContent, getMetadata, bucket };
});

vi.mock('firebase-admin', () => {
    const adminMock = {
        storage: () => ({ bucket: () => mocks.bucket }),
        firestore: () => ({}),
    };
    return { ...adminMock, default: adminMock };
});

vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentCreated: vi.fn(),
}));

vi.mock('../../lib/vertexClient', () => ({
    getVertexAIClient: () => ({ models: { generateContent: mocks.generateContent } }),
}));

import { analyzeEncounterWithGemini } from './processEncounterPipeline';
import type { EncounterMediaAsset } from './encounterEvidence';

const METADATA = { size: '100', contentType: 'audio/webm' };

function asset(type: EncounterMediaAsset['type'], i: number): EncounterMediaAsset {
    return { type, storagePath: `users/owner/encounters/e1/${type}${i}`, downloadUrl: `gs://proj/users/owner/encounters/e1/${type}${i}` } as EncounterMediaAsset;
}

const MIME_BY_TYPE: Record<string, string> = { audio: 'audio/webm', photo: 'image/jpeg', video: 'video/mp4' };

function modelJsonResponse(citedSource = 'asset_1') {
    return {
        text: JSON.stringify({
            summary: 'Met a promoter at the venue.',
            transcript: 'Great meeting you.',
            contact: { name: 'Example Promoter', phone: '+1234567890', confidence: 'high', evidence: { name: [citedSource], phone: [citedSource] } },
        }),
        candidates: [{ finishReason: 'STOP' }],
    };
}

beforeEach(() => {
    mocks.generateContent.mockReset();
    mocks.getMetadata.mockReset();
    // Storage metadata is authoritative: derive contentType/size from the object path.
    mocks.getMetadata.mockImplementation(async () => {
        const path = mocks.lastPath ?? 'audio';
        const type = ['audio', 'photo', 'video'].find(t => path.includes(`/${t}`)) ?? 'audio';
        return [{ size: '100', contentType: MIME_BY_TYPE[type] }];
    });
    mocks.generateContent.mockResolvedValue(modelJsonResponse());
});

describe('analyzeEncounterWithGemini — multi-asset wiring', () => {
    it('supplies every captured media type as labeled evidence parts in one model call', async () => {
        const result = await analyzeEncounterWithGemini({
            userId: 'owner',
            assets: [asset('audio', 0), asset('photo', 0), asset('video', 0)],
            locationContext: 'Latitude 42.33, Longitude -83.05 at The Venue',
        });

        expect(mocks.generateContent).toHaveBeenCalledTimes(1);
        const call = mocks.generateContent.mock.calls[0][0];
        const parts = call.contents[0].parts;
        // Per asset: one labeled text part + one media part.
        expect(parts.filter((p: { text?: string }) => p.text?.startsWith('Evidence source:'))).toHaveLength(3);
        const mediaParts = parts.filter((p: { fileData?: unknown }) => p.fileData);
        expect(mediaParts).toHaveLength(3);
        expect(mediaParts[0].fileData).toEqual({ fileUri: 'gs://proj/users/owner/encounters/e1/audio0', mimeType: 'audio/webm' });
        expect(mediaParts[1].fileData.mimeType).toBe('image/jpeg');
        expect(mediaParts[2].fileData.mimeType).toBe('video/mp4');
        expect(mediaParts[2].videoMetadata).toEqual({ startOffset: '0s', endOffset: '120s', fps: 1 });
        // Analysis instruction enumerates every supplied source id.
        const instruction = parts[parts.length - 1].text as string;
        for (const id of ['asset_0', 'asset_1', 'asset_2']) expect(instruction).toContain(id);
        // Parsed analysis flows back through the real parsing path.
        expect(result.contact?.name).toBe('Example Promoter');
        expect(result.confidence).toBe('high');
    });

    it('appends user context as a citable source when supplied', async () => {
        mocks.generateContent.mockResolvedValue(modelJsonResponse('asset_0'));
        await analyzeEncounterWithGemini({ userId: 'owner', assets: [asset('audio', 0)], clientContext: 'Met after the show' });
        const parts = mocks.generateContent.mock.calls[0][0].contents[0].parts;
        expect(parts.some((p: { text?: string }) => p.text?.includes('context (user note): Met after the show'))).toBe(true);
        expect(parts[parts.length - 1].text).toContain('asset_0, context');
    });

    it('rejects more than the maximum asset count', async () => {
        const assets = Array.from({ length: 9 }, (_, i) => asset('photo', i));
        await expect(analyzeEncounterWithGemini({ userId: 'owner', assets })).rejects.toThrow('at most eight');
        expect(mocks.generateContent).not.toHaveBeenCalled();
    });

    it('rejects an encounter with neither media nor user context', async () => {
        await expect(analyzeEncounterWithGemini({ userId: 'owner', assets: [] })).rejects.toThrow('No encounter evidence');
        expect(mocks.generateContent).not.toHaveBeenCalled();
    });

    it('enforces the combined byte cap across assets before dispatch', async () => {
        mocks.getMetadata.mockResolvedValue([{ size: String(30 * 1024 * 1024), contentType: 'audio/webm' }]);
        await expect(analyzeEncounterWithGemini({ userId: 'owner', assets: [asset('audio', 0), asset('audio', 1)] }))
            .rejects.toThrow('50 MB');
        expect(mocks.generateContent).not.toHaveBeenCalled();
    });

    it('treats a non-STOP finish reason as a failure, never as analysis', async () => {
        mocks.generateContent.mockResolvedValue({ text: '{"summary":"x"}', candidates: [{ finishReason: 'SAFETY' }] });
        await expect(analyzeEncounterWithGemini({ userId: 'owner', assets: [asset('audio', 0)] })).rejects.toThrow('did not complete');
    });

    it('treats an empty completion as a failure', async () => {
        mocks.generateContent.mockResolvedValue({ text: '', candidates: [{ finishReason: 'STOP' }] });
        await expect(analyzeEncounterWithGemini({ userId: 'owner', assets: [asset('audio', 0)] })).rejects.toThrow('did not complete');
    });

    it('rejects model output citing evidence sources that were never supplied', async () => {
        mocks.generateContent.mockResolvedValue({
            text: JSON.stringify({ summary: 'x', contact: { name: 'Invented', confidence: 'high', evidence: { name: ['asset_9'] } } }),
            candidates: [{ finishReason: 'STOP' }],
        });
        await expect(analyzeEncounterWithGemini({ userId: 'owner', assets: [asset('audio', 0)] })).rejects.toThrow();
    });
});
