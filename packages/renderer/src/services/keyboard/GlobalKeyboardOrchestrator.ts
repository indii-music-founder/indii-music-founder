import { logger } from '@/utils/logger';

export type ShortcutPriority = 'low' | 'normal' | 'high' | 'modal' | 'critical';

const PRIORITY_LEVELS: Record<ShortcutPriority, number> = {
    low: 10,
    normal: 20,
    high: 30,
    modal: 40,
    critical: 50
};

export interface ShortcutOptions {
    id: string;
    key: string | string[]; // e.g. 'Escape', '?', ['Meta', 'k']
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
    priority?: ShortcutPriority;
    ignoreInput?: boolean; // If true, shortcut works even when typing in an input
    handler: (e: KeyboardEvent) => void;
}

class KeyboardOrchestrator {
    private listeners: ShortcutOptions[] = [];
    private boundHandleKeyDown = this.handleKeyDown.bind(this);
    private boundHandleBlur = this.handleBlur.bind(this);
    private isInitialized = false;
    private lastInputBlurTime = 0;

    init() {
        if (this.isInitialized) return;
        if (typeof window === 'undefined') return;
        // Use capture phase to intercept before React synthetic events
        window.addEventListener('keydown', this.boundHandleKeyDown, { capture: true });
        window.addEventListener('blur', this.boundHandleBlur, { capture: true });
        this.isInitialized = true;
    }

    dispose() {
        if (typeof window === 'undefined') return;
        window.removeEventListener('keydown', this.boundHandleKeyDown, { capture: true });
        window.removeEventListener('blur', this.boundHandleBlur, { capture: true });
        this.isInitialized = false;
    }

    private handleBlur(e: FocusEvent) {
        if (this.isEventFromInput(e as any)) {
            this.lastInputBlurTime = Date.now();
        }
    }

    register(options: ShortcutOptions): () => void {
        // Ensure initialized
        this.init();

        this.listeners.push(options);
        // Sort highest priority first
        this.listeners.sort((a, b) => PRIORITY_LEVELS[b.priority || 'normal'] - PRIORITY_LEVELS[a.priority || 'normal']);
        
        return () => {
            this.unregister(options.id);
        };
    }

    unregister(id: string) {
        this.listeners = this.listeners.filter(l => l.id !== id);
    }

    public isEventFromInput(e: KeyboardEvent | React.KeyboardEvent): boolean {
        // Robust input detection via composedPath to catch shadow DOM and rapid focus shifts
        const event = 'nativeEvent' in e ? (e as React.KeyboardEvent).nativeEvent : (e as KeyboardEvent);
        const path = event.composedPath?.();
        if (path) {
            for (const node of path) {
                if (node instanceof HTMLElement) {
                    const tag = node.tagName?.toUpperCase();
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable) {
                        return true;
                    }
                }
            }
        }
        
        // Fallback to active element just in case
        const activeNode = document.activeElement as HTMLElement | null;
        if (activeNode) {
            const tag = activeNode.tagName?.toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA' || activeNode.isContentEditable) {
                return true;
            }
        }
        
        return false;
    }

    private handleKeyDown(e: KeyboardEvent) {
        const isInput = this.isEventFromInput(e);
        const recentlyBlurred = !isInput && (Date.now() - this.lastInputBlurTime < 200);

        const key = e.key.toLowerCase();
        const code = e.code;
        
        for (const listener of this.listeners) {
            if (!listener.ignoreInput && (isInput || recentlyBlurred)) {
                continue; // Skip this listener if typing in an input, or just blurred one
            }
            
            const rawKeys = Array.isArray(listener.key) ? listener.key : [listener.key];
            const lowerKeys = rawKeys.map(k => k.toLowerCase());
            
            // Check modifier keys (if specified strictly)
            if (listener.ctrl !== undefined && e.ctrlKey !== listener.ctrl) continue;
            if (listener.meta !== undefined && e.metaKey !== listener.meta) continue;
            if (listener.shift !== undefined && e.shiftKey !== listener.shift) continue;
            if (listener.alt !== undefined && e.altKey !== listener.alt) continue;
            
            // Check if key or code matches
            if (lowerKeys.includes(key) || rawKeys.includes(code)) {
                listener.handler(e);
                
                // If the handler called preventDefault or stopPropagation, assume they consumed it.
                // In vanilla JS events, we can't easily detect defaultPrevented immediately if they called it, 
                // but checking e.defaultPrevented works. Checking e.cancelBubble works for stopPropagation.
                if (e.defaultPrevented || e.cancelBubble) {
                    break;
                }
            }
        }
    }
}

export const globalKeyboardOrchestrator = new KeyboardOrchestrator();
