import type { AppSlice } from '@/core/store/slices/appSlice';

type ModuleId = AppSlice['currentModule'];

interface ModuleStore {
    getState(): { currentModule: ModuleId; setModule: (module: ModuleId) => Promise<void> };
}

/**
 * `setModule` can wait on an unsaved-changes confirmation, return without
 * navigating when the user declines, and drop a switch made within 100 ms of
 * the previous one. A tool must therefore await it and confirm the app really
 * ended up on the target before claiming it navigated.
 */
export async function navigateToModule(store: ModuleStore, module: ModuleId): Promise<boolean> {
    await store.getState().setModule(module);
    return store.getState().currentModule === module;
}

export function navigationNotCompletedMessage(module: ModuleId, current: ModuleId): string {
    return `Did not open ${module}: the switch was cancelled (for example an unsaved-changes prompt was declined) or is still waiting on the user. The app is still on ${current}.`;
}
