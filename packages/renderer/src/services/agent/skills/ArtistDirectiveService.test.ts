import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getDoc, getDocFromCache, setDoc, onSnapshot } from 'firebase/firestore';
import { artistDirectiveService, ArtistDirectiveService } from './ArtistDirectiveService';
import { DEFAULT_ARTIST_MASTER_DIRECTIVE, type ArtistMasterDirective } from '@indii/shared';

vi.mock('@/utils/authGuards', () => ({
    getRealAuthenticatedUserId: vi.fn(() => 'user-test-123'),
}));

vi.mock('@/utils/e2eMode', () => ({
    isFirebaseE2EMockEnabled: vi.fn(() => false),
}));

describe('ArtistDirectiveService', () => {
    let service: ArtistDirectiveService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ArtistDirectiveService();
    });

    it('returns DEFAULT_ARTIST_MASTER_DIRECTIVE when doc does not exist', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => false,
            data: () => undefined,
        } as any);

        const directive = await service.getDirective('user-test-123');
        expect(directive).toEqual(DEFAULT_ARTIST_MASTER_DIRECTIVE);
    });

    it('retrieves and parses stored valid directive', async () => {
        const customDirective: ArtistMasterDirective = {
            ...DEFAULT_ARTIST_MASTER_DIRECTIVE,
            artistName: 'Siren Sound',
            lastModifiedBy: 'agent',
            lastModifiedReason: 'Conductor calibrated mastering profile',
        };

        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ ...customDirective, updatedAt: { toDate: () => new Date('2026-03-01T12:00:00Z') } }),
        } as any);

        const directive = await service.getDirective('user-test-123');
        expect(directive.artistName).toBe('Siren Sound');
        expect(directive.lastModifiedBy).toBe('agent');
        expect(directive.lastModifiedReason).toBe('Conductor calibrated mastering profile');
    });

    describe('slow server read (ISSUE-1710)', () => {
        const saved: ArtistMasterDirective = { ...DEFAULT_ARTIST_MASTER_DIRECTIVE, artistName: 'Signal Bloom' };
        const snap = (d: ArtistMasterDirective) => ({ exists: () => true, data: () => d }) as any;

        it('uses the copy saved on this device after 5 s, and asks the server again next time', async () => {
            vi.useFakeTimers();
            try {
                vi.mocked(getDoc).mockReturnValueOnce(new Promise(() => {}) as any);
                vi.mocked(getDocFromCache).mockResolvedValueOnce(snap(saved));
                const pending = service.getDirective('user-test-123');
                await vi.advanceTimersByTimeAsync(5_000);
                await expect(pending).resolves.toMatchObject({ artistName: 'Signal Bloom' });

                vi.mocked(getDoc).mockResolvedValueOnce(snap({ ...saved, artistName: 'From server' }));
                await expect(service.getDirective('user-test-123')).resolves.toMatchObject({ artistName: 'From server' });
            } finally {
                vi.useRealTimers();
            }
        });

        it('keeps waiting for the server when nothing is saved on this device', async () => {
            vi.useFakeTimers();
            try {
                let resolveServer!: (v: unknown) => void;
                vi.mocked(getDoc).mockReturnValueOnce(new Promise(r => { resolveServer = r; }) as any);
                vi.mocked(getDocFromCache).mockRejectedValueOnce(new Error('Failed to get document from cache.'));
                const pending = service.getDirective('user-test-123');
                await vi.advanceTimersByTimeAsync(5_000);
                resolveServer(snap({ ...saved, artistName: 'Late server' }));
                await expect(pending).resolves.toMatchObject({ artistName: 'Late server' });
            } finally {
                vi.useRealTimers();
            }
        });

        it('does not touch the device copy when the server answers in time', async () => {
            vi.mocked(getDoc).mockResolvedValueOnce(snap(saved));
            await service.getDirective('user-test-123');
            expect(getDocFromCache).not.toHaveBeenCalled();
        });
    });

    describe('offline server read', () => {
        const saved: ArtistMasterDirective = { ...DEFAULT_ARTIST_MASTER_DIRECTIVE, artistName: 'Offline Signal' };
        const snap = (d: ArtistMasterDirective) => ({ exists: () => true, data: () => d }) as any;
        const offlineError = () => Object.assign(
            new Error('Failed to get document because the client is offline.'),
            { code: 'unavailable' }
        );

        it('falls back to getDocFromCache when getDoc rejects immediately as offline and queries server next time', async () => {
            vi.mocked(getDoc).mockRejectedValueOnce(offlineError());
            vi.mocked(getDocFromCache).mockResolvedValueOnce(snap(saved));

            await expect(service.getDirective('user-test-123')).resolves.toMatchObject({ artistName: 'Offline Signal' });
            expect(getDocFromCache).toHaveBeenCalledTimes(1);

            vi.mocked(getDoc).mockResolvedValueOnce(snap({ ...saved, artistName: 'Reconnected Server' }));
            await expect(service.getDirective('user-test-123')).resolves.toMatchObject({ artistName: 'Reconnected Server' });
        });

        it('rethrows the offline error when no cached directive exists on this device', async () => {
            const err = offlineError();
            vi.mocked(getDoc).mockRejectedValueOnce(err);
            vi.mocked(getDocFromCache).mockResolvedValueOnce({ exists: () => false, data: () => undefined } as any);

            await expect(service.getDirective('user-test-123')).rejects.toThrow('Failed to get document because the client is offline.');
        });

        it('does not call getDocFromCache on permission-denied errors', async () => {
            const err = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
            vi.mocked(getDoc).mockRejectedValueOnce(err);

            await expect(service.getDirective('user-test-123')).rejects.toThrow('Missing or insufficient permissions.');
            expect(getDocFromCache).not.toHaveBeenCalled();
        });
    });

    it('rejects a corrupt stored directive without replacing it', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ schemaVersion: 'corrupt-version', sections: {} }),
        } as any);

        await expect(service.getDirective('user-test-123')).rejects.toThrow('Stored artist directive failed schema validation');
        expect(setDoc).not.toHaveBeenCalled();
    });

    it('does not refine or save when the stored directive cannot be read', async () => {
        vi.mocked(getDoc).mockRejectedValueOnce(new Error('permission denied'));

        const result = await service.refineSection('sonicSpecs', 'New rule', 'add_rule', undefined, 'agent', 'user-test-123');

        expect(result).toEqual({ success: false, error: 'Artist directive could not be loaded' });
        expect(setDoc).not.toHaveBeenCalled();
    });

    it('does not emit defaults for an invalid live directive', () => {
        const callback = vi.fn();
        vi.mocked(onSnapshot).mockImplementationOnce(((_ref: any, onNext: (snap: any) => void) => {
            onNext({ exists: () => true, data: () => ({ sections: {} }) });
            return () => {};
        }) as any);

        service.subscribeToDirective('user-test-123', callback);

        expect(callback).not.toHaveBeenCalled();
    });

    it('saves a valid directive to Firestore', async () => {
        vi.mocked(setDoc).mockResolvedValueOnce(undefined as any);

        const updated: ArtistMasterDirective = {
            ...DEFAULT_ARTIST_MASTER_DIRECTIVE,
            artistName: 'Apex Duo',
        };

        const result = await service.saveDirective(updated, 'user', 'Updated in Studio UI', 'user-test-123');
        expect(result.success).toBe(true);
        expect(setDoc).toHaveBeenCalledTimes(1);
    });

    it('refuses to save an invalid directive schema', async () => {
        const corrupted = {
            ...DEFAULT_ARTIST_MASTER_DIRECTIVE,
            schemaVersion: 'invalid.version' as any,
        };

        const result = await service.saveDirective(corrupted, 'user', 'Testing error', 'user-test-123');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid directive schema');
        expect(setDoc).not.toHaveBeenCalled();
    });

    it('refines section by adding a rule', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => DEFAULT_ARTIST_MASTER_DIRECTIVE,
        } as any);
        vi.mocked(setDoc).mockResolvedValueOnce(undefined as any);

        const res = await service.refineSection(
            'sonicSpecs',
            'Always export FLAC 24-bit copies for archival',
            'add_rule',
            'Studio archiving standard',
            'agent',
            'user-test-123'
        );

        expect(res.success).toBe(true);
        expect(res.directive?.sections.sonicSpecs.rules).toContain('Always export FLAC 24-bit copies for archival');
        expect(res.directive?.lastModifiedBy).toBe('agent');
        expect(res.directive?.lastModifiedReason).toBe('Studio archiving standard');
    });

    it('refines section by removing a rule and setting content', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => DEFAULT_ARTIST_MASTER_DIRECTIVE,
        } as any);
        vi.mocked(setDoc).mockResolvedValueOnce(undefined as any);

        const ruleToRemove = 'True Peak ceiling: -1.0 dBTP';
        const removeRes = await service.refineSection(
            'sonicSpecs',
            ruleToRemove,
            'remove_rule',
            'Custom peak tolerance',
            'user',
            'user-test-123'
        );

        expect(removeRes.success).toBe(true);
        expect(removeRes.directive?.sections.sonicSpecs.rules).not.toContain(ruleToRemove);
    });

    it('formats directive for prompt with supreme override framing', () => {
        const formatted = service.formatDirectiveForPrompt(DEFAULT_ARTIST_MASTER_DIRECTIVE);
        expect(formatted).toContain('<artist_master_directive priority="SUPREME_OVERRIDE">');
        expect(formatted).toContain('CRITICAL INSTRUCTION FOR ALL AGENTS & ENGINES:');
        expect(formatted).toContain('# Artist Master Directive: Artist');
        expect(formatted).toContain('## Sonic & Mastering Standards');
        expect(formatted).toContain('</artist_master_directive>');
    });

    it('subscribes to snapshot updates', () => {
        let callbackReceived: ArtistMasterDirective | null = null;
        vi.mocked(onSnapshot).mockImplementationOnce(((_ref: any, onNext: (snap: any) => void) => {
            onNext({
                exists: () => true,
                data: () => ({ ...DEFAULT_ARTIST_MASTER_DIRECTIVE, artistName: 'Streaming Star' }),
            });
            return () => {};
        }) as any);

        const unsubscribe = service.subscribeToDirective('user-test-123', (directive) => {
            callbackReceived = directive;
        });

        expect(callbackReceived).not.toBeNull();
        expect(callbackReceived?.artistName).toBe('Streaming Star');
        expect(typeof unsubscribe).toBe('function');
    });

    it('exports singleton artistDirectiveService instance', () => {
        expect(artistDirectiveService).toBeInstanceOf(ArtistDirectiveService);
    });
});
