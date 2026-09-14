import { describe, expect, it } from 'vitest';
import {
    ArtistMasterDirectiveSchema,
    DEFAULT_ARTIST_MASTER_DIRECTIVE,
    DirectiveSectionSchema,
    compileDirectiveToMarkdown,
    DIRECTIVE_SECTION_KEYS,
    type ArtistMasterDirective,
} from './artistMasterDirective';

describe('ArtistMasterDirectiveSchema', () => {
    it('successfully parses DEFAULT_ARTIST_MASTER_DIRECTIVE', () => {
        const result = ArtistMasterDirectiveSchema.safeParse(DEFAULT_ARTIST_MASTER_DIRECTIVE);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.schemaVersion).toBe('artist-master-directive.v1');
            expect(result.data.artistName).toBe('Artist');
            expect(result.data.lastModifiedBy).toBe('user');
        }
    });

    it('contains all 5 canonical section keys', () => {
        expect(DIRECTIVE_SECTION_KEYS).toEqual([
            'sonicSpecs',
            'businessLegal',
            'brandingAesthetics',
            'releaseDistribution',
            'customPlaybook',
        ]);
        for (const key of DIRECTIVE_SECTION_KEYS) {
            expect(DEFAULT_ARTIST_MASTER_DIRECTIVE.sections[key]).toBeDefined();
            expect(DEFAULT_ARTIST_MASTER_DIRECTIVE.sections[key].title).toBeTruthy();
        }
    });

    it('validates a single directive section schema', () => {
        const validSection = {
            title: 'Touring Specs',
            description: 'Monitor mixes and in-ear preferences',
            content: 'Stereo in-ear mix with dry lead vocal',
            rules: ['Stereo in-ear mix with dry lead vocal'],
        };
        const result = DirectiveSectionSchema.safeParse(validSection);
        expect(result.success).toBe(true);
    });

    it('rejects an invalid schema version', () => {
        const invalid = {
            ...DEFAULT_ARTIST_MASTER_DIRECTIVE,
            schemaVersion: 'artist-master-directive.v2',
        };
        const result = ArtistMasterDirectiveSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it('rejects unknown properties due to strict validation', () => {
        const invalid = {
            ...DEFAULT_ARTIST_MASTER_DIRECTIVE,
            unknownProp: 'disallowed',
        };
        const result = ArtistMasterDirectiveSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it('enforces string limits on section rules', () => {
        const invalidSection = {
            title: 'Test',
            description: 'Test',
            content: '',
            rules: ['a'.repeat(501)], // max is 500
        };
        const result = DirectiveSectionSchema.safeParse(invalidSection);
        expect(result.success).toBe(false);
    });
});

describe('compileDirectiveToMarkdown', () => {
    it('compiles default directive to well-structured markdown', () => {
        const md = compileDirectiveToMarkdown(DEFAULT_ARTIST_MASTER_DIRECTIVE);
        expect(md).toContain('# Artist Master Directive: Artist');
        expect(md).toContain('*Last modified by user*');
        expect(md).toContain('## Sonic & Mastering Standards');
        expect(md).toContain('- Target integrated loudness: -14 LUFS (streaming baseline)');
        expect(md).toContain('## Business & Legal Red Lines');
        expect(md).toContain('## Brand & Aesthetic Identity');
        expect(md).toContain('## Release & Distribution Protocol');
    });

    it('includes supplemental custom markdown and lastModifiedReason if present', () => {
        const customDirective: ArtistMasterDirective = {
            ...DEFAULT_ARTIST_MASTER_DIRECTIVE,
            artistName: 'Luna Apex',
            lastModifiedBy: 'agent',
            lastModifiedReason: 'Mastering session detected 96kHz stem preference',
            customRawMarkdown: '### Additional Gear Preferences\n- Prefers SSL G-Master Bus compressor emulation.',
        };

        const md = compileDirectiveToMarkdown(customDirective);
        expect(md).toContain('# Artist Master Directive: Luna Apex');
        expect(md).toContain('*Last modified by agent (Mastering session detected 96kHz stem preference)*');
        expect(md).toContain('## Supplemental Custom Directives');
        expect(md).toContain('Prefers SSL G-Master Bus compressor emulation.');
    });
});
