import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getRequestedSettingsSection,
    requestSettingsSection,
    SETTINGS_SECTION_REQUEST_EVENT,
} from './SettingsNavigation';

describe('SettingsNavigation', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/settings');
    });

    it('accepts only known settings section deep links', () => {
        expect(getRequestedSettingsSection('?section=remote')).toBe('remote');
        expect(getRequestedSettingsSection('?section=not-real')).toBe('profile');
    });

    it('updates the deep link and notifies an already-mounted Settings panel', () => {
        const listener = vi.fn();
        window.addEventListener(SETTINGS_SECTION_REQUEST_EVENT, listener);

        requestSettingsSection('remote');

        expect(window.location.search).toBe('?section=remote');
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: 'remote' }));
        window.removeEventListener(SETTINGS_SECTION_REQUEST_EVENT, listener);
    });
});
