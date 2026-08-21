import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import LoginBridge from './page';

const { signInWithPopupMock, credentialFromResultMock } = vi.hoisted(() => ({
    signInWithPopupMock: vi.fn(),
    credentialFromResultMock: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: class {
        static credentialFromResult = credentialFromResultMock;
        addScope() {}
    },
    signInWithPopup: (...args: any[]) => signInWithPopupMock(...args),
    onAuthStateChanged: (_auth: unknown, cb: () => void) => {
        cb();
        return () => {};
    },
}));

vi.mock('../lib/firebase', () => ({
  default: {},
  db: undefined,
}));

describe('LoginBridge deep-link flows', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        Object.defineProperty(window, 'location', {
            value: { href: 'http://localhost/' },
            writable: true,
        });
        (navigator as any).clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllMocks();
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('shows success redirect state after auth succeeds', async () => {
        signInWithPopupMock.mockResolvedValue({ user: {} });
        credentialFromResultMock.mockReturnValue({ idToken: 'id-token', accessToken: 'access-token' });

        await act(async () => {
            root.render(<LoginBridge />);
        });

        const btn = container.querySelector('button');
        expect(btn?.textContent).toContain('Continue with Google');

        await act(async () => {
            btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(container.textContent).toContain('Success! Redirecting to app...');
        expect(window.location.href).toContain('indii://auth/callback?');
        expect(window.location.href).toContain('source=founder');
    });

    it('renders deep-link timeout fallback after redirect does not leave page', async () => {
        signInWithPopupMock.mockResolvedValue({ user: {} });
        credentialFromResultMock.mockReturnValue({ idToken: 'id-token' });

        await act(async () => {
            root.render(<LoginBridge />);
        });

        await act(async () => {
            container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(container.textContent).toContain('Could not switch to the desktop app automatically');
        expect(container.textContent).toContain('Open app again');
        expect(container.textContent).toContain('Copy callback token package');
    });

    it('retries deep link when user clicks Open app again', async () => {
        signInWithPopupMock.mockResolvedValue({ user: {} });
        credentialFromResultMock.mockReturnValue({ idToken: 'id-token' });

        await act(async () => {
            root.render(<LoginBridge />);
        });

        await act(async () => {
            container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        const before = window.location.href;
        const retryButton = Array.from(container.querySelectorAll('button')).find((el) => el.textContent?.includes('Open app again'));

        await act(async () => {
            retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(window.location.href).toContain('indii://auth/callback?');
        expect(window.location.href).toBe(before);
    });

    it('shows a friendly error when the handoff service hangs instead of leaving the visitor stuck on "Signing in..."', async () => {
        vi.stubEnv('VITE_AUTH_HANDOFF_URL', 'https://handoff.example.test/code');
        signInWithPopupMock.mockResolvedValue({ user: {} });
        credentialFromResultMock.mockReturnValue({ idToken: 'id-token' });

        const abortListener = vi.fn();
        vi.stubGlobal(
            'fetch',
            vi.fn((_url: string, init?: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        abortListener();
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    });
                }),
            ),
        );

        await act(async () => {
            root.render(<LoginBridge />);
        });

        await act(async () => {
            container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        // Handoff fetch is still pending — the page must not be stuck forever.
        await act(async () => {
            vi.advanceTimersByTime(15000);
        });

        expect(abortListener).toHaveBeenCalledTimes(1);
        expect(container.textContent).toContain('took too long to respond');
        expect(container.textContent).toContain('Try Again');
    });
});
