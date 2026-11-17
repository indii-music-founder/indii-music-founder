import { describe, it, expect, vi } from 'vitest';
import { navigateToModule } from '../navigationOutcome';

const makeStore = (apply: (state: { currentModule: string }, module: string) => Promise<void>) => {
    const state = { currentModule: 'dashboard', setModule: async (module: string) => apply(state, module) };
    return { getState: () => state } as never;
};

describe('navigateToModule', () => {
    it('confirms navigation only after setModule settles on the target', async () => {
        const store = makeStore(async (state, module) => {
            await new Promise(resolve => setTimeout(resolve, 5));
            state.currentModule = module;
        });
        expect(await navigateToModule(store, 'registration' as never)).toBe(true);
    });

    it('reports failure when the user declines the unsaved-changes prompt', async () => {
        const store = makeStore(async () => undefined);
        expect(await navigateToModule(store, 'registration' as never)).toBe(false);
    });

    it('waits for the pending confirmation instead of assuming success', async () => {
        const resolveSpy = vi.fn();
        let approve!: () => void;
        const store = makeStore(async (state, module) => {
            await new Promise<void>(resolve => { approve = resolve; });
            state.currentModule = module;
            resolveSpy();
        });
        const pending = navigateToModule(store, 'studio' as never);
        expect(resolveSpy).not.toHaveBeenCalled();
        approve();
        expect(await pending).toBe(true);
    });
});
