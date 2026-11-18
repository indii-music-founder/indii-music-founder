/**
 * Present mode — a clean-screenshot / screen-recording view of the studio.
 *
 * Turn on with `?present=1` in the URL or Shift+P (ignored while typing).
 * While on, the shell skips floating chrome that spoils screenshots: toasts,
 * feedback/tour/cookie/PWA prompts, background monitors and dev warnings.
 * UI-only and not persisted: a reload without `?present=1` returns to normal.
 */
import { useSyncExternalStore } from 'react';

type Listener = () => void;

const listeners = new Set<Listener>();
let presenting = readInitial();

function readInitial(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const value = new URLSearchParams(window.location.search).get('present');
        return value === '1' || value === 'true';
    } catch {
        return false;
    }
}

function emit() {
    for (const listener of listeners) listener();
}

export function isPresenting(): boolean {
    return presenting;
}

export function setPresenting(next: boolean): void {
    if (presenting === next) return;
    presenting = next;
    emit();
}

export function togglePresenting(): void {
    setPresenting(!presenting);
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function usePresentMode(): boolean {
    return useSyncExternalStore(subscribe, isPresenting, () => false);
}

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Shift+P toggles present mode. Returns a cleanup function. */
export function installPresentModeShortcut(): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
        if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key !== 'P' && event.key !== 'p') return;
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        togglePresenting();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
}

/** Test-only reset. */
export function __resetPresentModeForTests(value = false): void {
    presenting = value;
    emit();
}
