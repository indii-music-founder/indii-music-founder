import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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

    it('falls back to default if stored directive fails schema validation', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ schemaVersion: 'corrupt-version', sections: {} }),
        } as any);

        const directive = await service.getDirective('user-test-123');
        expect(directive).toEqual(DEFAULT_ARTIST_MASTER_DIRECTIVE);
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
