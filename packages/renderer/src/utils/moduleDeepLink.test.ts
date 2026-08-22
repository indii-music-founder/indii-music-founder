import { describe, it, expect } from 'vitest';
import { readModuleDeepLink } from './moduleDeepLink';

describe('readModuleDeepLink', () => {
    it('resolves a valid module id', () => {
        expect(readModuleDeepLink('?module=founders-checkout')).toBe('founders-checkout');
    });

    it('keeps the rest of the query intact', () => {
        expect(readModuleDeepLink('?source=founder&module=distribution')).toBe('distribution');
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
