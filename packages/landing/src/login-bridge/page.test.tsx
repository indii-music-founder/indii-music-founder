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
        expect(window.location.href).toContain('indii-os://auth/callback?');
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

        expect(window.location.href).toContain('indii-os://auth/callback?');
        expect(window.location.href).toBe(before);
    });
});
