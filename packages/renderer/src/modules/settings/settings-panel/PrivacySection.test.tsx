import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadDoNotSell, saveDoNotSell, toast } = vi.hoisted(() => ({
    loadDoNotSell: vi.fn(),
    saveDoNotSell: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/services/privacy/PrivacyPreferencesService', () => ({
    PrivacyPreferencesService: { loadDoNotSell, saveDoNotSell },
}));
vi.mock('@/core/store', () => ({
    useStore: (selector: (s: { user: { uid: string } }) => unknown) => selector({ user: { uid: 'u1' } }),
}));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => toast }));

import PrivacySection from '@/modules/settings/settings-panel/PrivacySection';
import { getConsentPreferences } from '@/services/privacy/consent';

describe('PrivacySection', () => {
    beforeEach(() => {
        localStorage.clear();
        loadDoNotSell.mockReset();
        saveDoNotSell.mockReset();
    });

    it('lets the user turn error reports on and off after the cookie banner', () => {
        loadDoNotSell.mockResolvedValueOnce(false);
        render(<PrivacySection />);
        const toggle = screen.getByRole('switch', { name: 'Error reports' });

        expect(toggle).toHaveAttribute('aria-checked', 'false');
        fireEvent.click(toggle);
        expect(getConsentPreferences()?.errorTracking).toBe(true);
        expect(toggle).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(toggle);
        expect(getConsentPreferences()?.errorTracking).toBe(false);
    });

    it('loads and saves the Do Not Sell opt-out for the account', async () => {
        loadDoNotSell.mockResolvedValueOnce(false);
        saveDoNotSell.mockResolvedValueOnce(undefined);
        render(<PrivacySection />);
        const toggle = screen.getByRole('switch', { name: /Do Not Sell or Share/ });

        await waitFor(() => expect(toggle).not.toBeDisabled());
        fireEvent.click(toggle);

        await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
        expect(saveDoNotSell).toHaveBeenCalledWith('u1', true);
        expect(toast.success).toHaveBeenCalled();
    });

    it('keeps the previous choice and says so when saving fails', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        loadDoNotSell.mockResolvedValueOnce(false);
        saveDoNotSell.mockRejectedValueOnce(new Error('offline'));
        render(<PrivacySection />);
        const toggle = screen.getByRole('switch', { name: /Do Not Sell or Share/ });

        await waitFor(() => expect(toggle).not.toBeDisabled());
        fireEvent.click(toggle);

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(error).toHaveBeenCalled();
    });
});
