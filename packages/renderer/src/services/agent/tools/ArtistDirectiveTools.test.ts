import { describe, expect, it, vi, beforeEach } from 'vitest';
import { read_artist_directive, refine_artist_directive } from './ArtistDirectiveTools';
import { artistDirectiveService } from '../skills/ArtistDirectiveService';
import { DEFAULT_ARTIST_MASTER_DIRECTIVE } from '@indii/shared';

vi.mock('../skills/ArtistDirectiveService', () => ({
    artistDirectiveService: {
        getDirective: vi.fn(),
        refineSection: vi.fn(),
    },
}));

describe('ArtistDirectiveTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('read_artist_directive', () => {
        it('returns entire directive when no sectionKey is specified', async () => {
            vi.mocked(artistDirectiveService.getDirective).mockResolvedValueOnce(DEFAULT_ARTIST_MASTER_DIRECTIVE);

            const result = await read_artist_directive({});
            expect(result.success).toBe(true);
            expect(result.data.directive).toEqual(DEFAULT_ARTIST_MASTER_DIRECTIVE);
            expect(result.data.formattedMarkdown).toContain('# Artist Master Directive: Artist');
        });

        it('returns a specific section when sectionKey is valid', async () => {
            vi.mocked(artistDirectiveService.getDirective).mockResolvedValueOnce(DEFAULT_ARTIST_MASTER_DIRECTIVE);

            const result = await read_artist_directive({ sectionKey: 'sonicSpecs' });
            expect(result.success).toBe(true);
            expect(result.data.sectionKey).toBe('sonicSpecs');
            expect(result.data.title).toBe('Sonic & Mastering Standards');
            expect(result.data.rules).toBeInstanceOf(Array);
        });

        it('returns an error if sectionKey is invalid', async () => {
            vi.mocked(artistDirectiveService.getDirective).mockResolvedValueOnce(DEFAULT_ARTIST_MASTER_DIRECTIVE);

            const result = await read_artist_directive({ sectionKey: 'nonexistentSection' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid sectionKey');
        });
    });

    describe('refine_artist_directive', () => {
        it('rejects call with missing sectionKey', async () => {
            const result = await refine_artist_directive({
                sectionKey: '',
                ruleOrContent: 'Some rule',
                action: 'add_rule',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('requires a sectionKey');
        });

        it('rejects call with invalid sectionKey', async () => {
            const result = await refine_artist_directive({
                sectionKey: 'invalidKey',
                ruleOrContent: 'Some rule',
                action: 'add_rule',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid sectionKey');
        });

        it('rejects call with invalid action', async () => {
            const result = await refine_artist_directive({
                sectionKey: 'businessLegal',
                ruleOrContent: 'Some rule',
                action: 'invalid_action' as any,
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid action');
        });

        it('rejects empty ruleOrContent', async () => {
            const result = await refine_artist_directive({
                sectionKey: 'brandingAesthetics',
                ruleOrContent: '   ',
                action: 'add_rule',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('non-empty string');
        });

        it('successfully refines a section and returns toolSuccess', async () => {
            const updatedDirective = {
                ...DEFAULT_ARTIST_MASTER_DIRECTIVE,
                sections: {
                    ...DEFAULT_ARTIST_MASTER_DIRECTIVE.sections,
                    releaseDistribution: {
                        ...DEFAULT_ARTIST_MASTER_DIRECTIVE.sections.releaseDistribution,
                        rules: [
                            ...DEFAULT_ARTIST_MASTER_DIRECTIVE.sections.releaseDistribution.rules,
                            'Never release on Fridays without 3 weeks pre-save',
                        ],
                    },
                },
            };

            vi.mocked(artistDirectiveService.refineSection).mockResolvedValueOnce({
                success: true,
                directive: updatedDirective,
            });

            const result = await refine_artist_directive({
                sectionKey: 'releaseDistribution',
                ruleOrContent: 'Never release on Fridays without 3 weeks pre-save',
                action: 'add_rule',
                reason: 'Artist confirmed schedule restriction',
            });

            expect(result.success).toBe(true);
            expect(result.data.sectionKey).toBe('releaseDistribution');
            expect(result.data.action).toBe('add_rule');
            expect(artistDirectiveService.refineSection).toHaveBeenCalledWith(
                'releaseDistribution',
                'Never release on Fridays without 3 weeks pre-save',
                'add_rule',
                'Artist confirmed schedule restriction',
                'agent'
            );
        });
    });
});
