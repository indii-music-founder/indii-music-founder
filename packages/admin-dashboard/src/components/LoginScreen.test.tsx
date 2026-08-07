import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../firebase', () => ({ auth: {} }));

const isSignInWithEmailLink = vi.fn();
const signInWithEmailLink = vi.fn();
const sendSignInLinkToEmail = vi.fn();

vi.mock('firebase/auth', () => ({
    isSignInWithEmailLink: (...args: unknown[]) => isSignInWithEmailLink(...args),
    signInWithEmailLink: (...args: unknown[]) => signInWithEmailLink(...args),
    sendSignInLinkToEmail: (...args: unknown[]) => sendSignInLinkToEmail(...args),
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
    beforeEach(() => {
        isSignInWithEmailLink.mockReturnValue(false);
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects a non-@indii.music email before ever calling Firebase', async () => {
        render(<LoginScreen />);
        fireEvent.change(screen.getByPlaceholderText('you@indii.music'), { target: { value: 'someone@gmail.com' } });
        fireEvent.click(screen.getByText('Send Magic Link'));

        await waitFor(() => expect(screen.getByText(/Only @indii.music accounts/)).toBeDefined());
        expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });

    it('sends the magic link and shows a real confirmation for a valid domain', async () => {
        sendSignInLinkToEmail.mockResolvedValue(undefined);
        render(<LoginScreen />);
        fireEvent.change(screen.getByPlaceholderText('you@indii.music'), { target: { value: 'admin@indii.music' } });
        fireEvent.click(screen.getByText('Send Magic Link'));

        await waitFor(() => expect(screen.getByText('Verification Link Sent')).toBeDefined());
        expect(sendSignInLinkToEmail).toHaveBeenCalledWith(expect.anything(), 'admin@indii.music', expect.any(Object));
        expect(screen.getByText('admin@indii.music')).toBeDefined();
    });

    it('surfaces a real Firebase error instead of pretending the link sent', async () => {
        sendSignInLinkToEmail.mockRejectedValue(new Error('auth/network-request-failed'));
        render(<LoginScreen />);
        fireEvent.change(screen.getByPlaceholderText('you@indii.music'), { target: { value: 'admin@indii.music' } });
        fireEvent.click(screen.getByText('Send Magic Link'));

        await waitFor(() => expect(screen.getByText('auth/network-request-failed')).toBeDefined());
        expect(screen.queryByText('Verification Link Sent')).toBeNull();
    });

    it('shows the connecting state and surfaces an error when returning from an email link with no stored email', async () => {
        isSignInWithEmailLink.mockReturnValue(true);
        render(<LoginScreen />);
        await waitFor(() => expect(screen.getByText(/Email not found/)).toBeDefined());
        expect(signInWithEmailLink).not.toHaveBeenCalled();
    });
});
