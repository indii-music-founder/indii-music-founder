import { describe, expect, it } from 'vitest';
import { resolveEditModel } from './editModel';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

describe('editor model labels', () => {
    it.each(['flash', 'fast'])('resolves %s to the configured image model', label => {
        expect(resolveEditModel(label)).toBe(INTELLIGENCE_MODELS.IMAGE.FAST);
    });

    it('resolves Pro and the default to the configured Pro image model', () => {
        expect(resolveEditModel('pro')).toBe(INTELLIGENCE_MODELS.IMAGE.GENERATION);
        expect(resolveEditModel()).toBe(INTELLIGENCE_MODELS.IMAGE.GENERATION);
    });

    it('preserves an explicit model ID', () => {
        expect(resolveEditModel(INTELLIGENCE_MODELS.IMAGE.FAST)).toBe(INTELLIGENCE_MODELS.IMAGE.FAST);
    });
});
