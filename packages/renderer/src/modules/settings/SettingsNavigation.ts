export const SETTINGS_SECTION_REQUEST_EVENT = 'indii:settings-section-request';

export const SETTINGS_SECTION_IDS = [
    'profile',
    'connections',
    'remote',
    'notifications',
    'appearance',
    'desktop',
    'security',
] as const;

export type SettingsSectionId = typeof SETTINGS_SECTION_IDS[number];

export function getRequestedSettingsSection(search?: string): SettingsSectionId {
    const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
    const requested = new URLSearchParams(query).get('section');
    return isSettingsSectionId(requested) ? requested : 'profile';
}

export function requestSettingsSection(section: SettingsSectionId): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', section);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new CustomEvent<SettingsSectionId>(SETTINGS_SECTION_REQUEST_EVENT, { detail: section }));
}

function isSettingsSectionId(value: string | null): value is SettingsSectionId {
    return value !== null && (SETTINGS_SECTION_IDS as readonly string[]).includes(value);
}
