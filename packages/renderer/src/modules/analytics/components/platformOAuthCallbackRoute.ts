export type PlatformOAuthCallbackProvider = 'spotify' | 'tiktok';

const CALLBACK_PATHS: Readonly<Record<string, PlatformOAuthCallbackProvider>> = Object.freeze({
    '/auth/spotify/callback': 'spotify',
    '/auth/tiktok/callback': 'tiktok',
});

export function getPlatformOAuthCallbackProvider(
    pathname: string,
): PlatformOAuthCallbackProvider | null {
    const normalizedPath = pathname.replace(/\/+$/, '') || '/';
    return CALLBACK_PATHS[normalizedPath] ?? null;
}
