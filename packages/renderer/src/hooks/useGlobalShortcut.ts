import { useEffect } from 'react';
import { globalKeyboardOrchestrator, ShortcutOptions } from '@/services/keyboard/GlobalKeyboardOrchestrator';

export function useGlobalShortcut(options: ShortcutOptions, deps: React.DependencyList = [], active: boolean = true) {
    useEffect(() => {
        if (!active) return;
        const unregister = globalKeyboardOrchestrator.register(options);
        return () => {
            unregister();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, active]);
}
