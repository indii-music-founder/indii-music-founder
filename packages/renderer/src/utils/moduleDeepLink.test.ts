import { describe, it, expect } from 'vitest';
import { readModuleDeepLink } from './moduleDeepLink';

describe('readModuleDeepLink', () => {
    it('resolves a valid module id', () => {
        expect(readModuleDeepLink('?module=founders-checkout')).toBe('founders-checkout');
    });

    it('keeps the rest of the query intact', () => {
        expect(readModuleDeepLink('?source=founder&module=distribution')).toBe('distribution');
    });

    it('routes campaign funnel links into Flow-Be even when they include a creative module parameter', () => {
        expect(readModuleDeepLink('?module=creative&mode=free_demo')).toBe('workflow');
        expect(readModuleDeepLink('?demo=true')).toBe('workflow');
    });

    it('returns null for unknown modules rather than crashing navigation', () => {
        expect(readModuleDeepLink('?module=not-a-real-module')).toBeNull();
    });

    it('returns null when the parameter is absent or empty', () => {
        expect(readModuleDeepLink('?source=founder')).toBeNull();
        expect(readModuleDeepLink('?module=')).toBeNull();
        expect(readModuleDeepLink('')).toBeNull();
    });
});
