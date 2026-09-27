/** Pure contract tests only; these do not claim live media extraction works. */
import { describe, it, expect } from 'vitest';
import { buildEncounterMediaPart, resolveEncounterAsset, parseEncounterAnalysis } from './encounterEvidence';

describe('Encounter evidence boundaries (structural)', () => {
    it.each([
        ['audio', 'audio/webm'], ['photo', 'image/jpeg'], ['video', 'video/mp4'],
        ['document', 'application/pdf'], ['receipt', 'image/png'],
    ])('attaches %s evidence as a media part', (type, mime) => {
        const part = buildEncounterMediaPart(type, 'gs://project/users/owner/assets/capture', mime, 100);
        expect(part.fileData).toEqual({ fileUri: 'gs://project/users/owner/assets/capture', mimeType: mime });
        expect(part.videoMetadata).toEqual(type === 'video' ? { startOffset: '0s', endOffset: '120s', fps: 1 } : undefined);
    });
    it('accepts owned voice memos and rejects cross-account storage', () => {
        expect(resolveEncounterAsset({ type: 'audio', storagePath: 'users/owner/voice_memos/capture.webm' }, 'owner', 'project')).toBe('users/owner/voice_memos/capture.webm');
        expect(() => resolveEncounterAsset({ type: 'photo', storagePath: 'users/other/assets/capture.jpg' }, 'owner', 'project')).toThrow();
        expect(() => resolveEncounterAsset({ type: 'photo', storagePath: 'users/owner/../other/capture.jpg' }, 'owner', 'project')).toThrow();
    });
    it('rejects unrelated buckets and mismatched download references', () => {
        expect(() => resolveEncounterAsset({ type: 'photo', downloadUrl: 'gs://foreign/users/owner/capture' }, 'owner', 'project')).toThrow();
        expect(() => resolveEncounterAsset({ type: 'photo', storagePath: 'users/owner/a', downloadUrl: 'https://storage.googleapis.com/project/users/owner/b' }, 'owner', 'project')).toThrow();
    });
    it('rejects unsupported, empty and oversized files before model dispatch', () => {
        expect(() => buildEncounterMediaPart('photo', 'gs://project/image', 'text/html', 1)).toThrow();
        expect(() => buildEncounterMediaPart('audio', 'gs://project/audio', 'audio/webm', 0)).toThrow();
        expect(() => buildEncounterMediaPart('video', 'gs://project/video', 'video/mp4', 51 * 1024 * 1024)).toThrow();
    });
    it('keeps uncertainty and removes fields without supplied evidence references', () => {
        const result = parseEncounterAnalysis(JSON.stringify({ summary: 'Contract fixture', contact: {
            name: 'Example', phone: 'unsupported', organization: 'Example Org', confidence: 'uncertain',
            evidence: { name: ['asset_0'], phone: ['invented_source'], organization: ['asset_0'] },
        } }), ['asset_0']);
        expect(result.contact).toEqual({ name: 'Example', organization: 'Example Org' });
        expect(result.confidence).toBe('uncertain');
    });
    it('rejects malformed output and unsupported contact identity', () => {
        expect(() => parseEncounterAnalysis('not json', ['asset_0'])).toThrow();
        expect(() => parseEncounterAnalysis(JSON.stringify({ summary: 'x', contact: { name: 'Example', confidence: 'high', evidence: { name: ['absent'] } } }), ['asset_0'])).toThrow();
        expect(parseEncounterAnalysis('{"summary":"No contact found","contact":null}', ['asset_0']).contact).toBeUndefined();
    });
});
