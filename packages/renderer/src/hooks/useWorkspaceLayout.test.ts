import { describe, expect, it } from 'vitest';
import { getWorkspaceMode } from './useWorkspaceLayout';

describe('getWorkspaceMode', () => {
    it.each([
        [839, 'focused'],
        [840, 'standard'],
        [1199, 'standard'],
        [1200, 'wide'],
    ] as const)('uses the module container width at %ipx', (width, expected) => {
        expect(getWorkspaceMode(width)).toBe(expected);
    });
});
