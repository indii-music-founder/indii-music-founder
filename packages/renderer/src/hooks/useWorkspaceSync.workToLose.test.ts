import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/store', () => ({ useStore: { getState: vi.fn() }, getWorkspaceSnapshot: vi.fn(), applyWorkspaceSnapshot: vi.fn(), resetStoreForWorkspaceBoundary: vi.fn() }));
vi.mock('@/core/store/slices/livingPlanSlice', () => ({ useLivingPlanSlice: vi.fn() }));

import { hasLocalWorkToLose } from '@/hooks/useWorkspaceSync';

const note = (id: string, text = 'idea') => ({ id, title: id, content: text }) as never;

describe('hasLocalWorkToLose (ISSUE-1708)', () => {
    it('is false for a fresh page load with no local work, so the newer copy loads without asking', () => {
        expect(hasLocalWorkToLose({ notes: [], referencedAssets: [], selectedPlanId: null, creativePrompt: '  ', activeAgents: ['legal'] },
            { notes: [note('n1')], creativePrompt: 'from the desktop' })).toBe(false);
    });

    it('is false when local work matches the cloud copy', () => {
        expect(hasLocalWorkToLose({ notes: [note('n1')], creativePrompt: 'same' }, { notes: [note('n1')], creativePrompt: 'same' })).toBe(false);
    });

    it('is true when this device has a note, prompt or plan the cloud copy lacks', () => {
        expect(hasLocalWorkToLose({ notes: [note('n2', 'only here')] }, { notes: [] })).toBe(true);
        expect(hasLocalWorkToLose({ creativePrompt: 'typed here' }, { creativePrompt: '' })).toBe(true);
        expect(hasLocalWorkToLose({ selectedPlanId: 'plan-1' }, { selectedPlanId: null })).toBe(true);
    });
});
