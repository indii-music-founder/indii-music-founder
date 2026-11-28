const nonPublicSuffixes = ['.localhost', '.local', '.internal', '.test', '.invalid', '.example', '.onion', '.arpa'];
const specialistHosts = new Set(['artists.spotify.com', 'fonts.google.com']);
const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** DNS name filter only. The worker also validates the resolved addresses before connecting. */
export function isBoardroomBrowserHostname(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, '');
    const labels = host.split('.');
    const suffix = labels[labels.length - 1];
    return host.length <= 253 && labels.length > 1 && /^[a-z]/.test(suffix)
        && labels.every(label => dnsLabel.test(label))
        && !nonPublicSuffixes.some(blocked => host.endsWith(blocked));
}

export function parseBoardroomPublicPage(value: string): URL | undefined {
    try {
        const url = new URL(value);
        if (url.protocol === 'https:' && !url.port && !url.username && !url.password && isBoardroomBrowserHostname(url.hostname)) {
            url.hostname = url.hostname.replace(/\.$/, '');
            return url;
        }
    } catch {
        return undefined;
    }
}

export function parseBoardroomBrowserAddress(value: string): URL | undefined {
    const address = value.trim();
    if (!address || /\s/.test(address)) return undefined;
    return parseBoardroomPublicPage(
        /^[a-z][a-z0-9+.-]*:\/\//i.test(address) ? address.replace(/^http:/i, 'https:') : `https://${address}`,
    );
}

export function isBoardroomWebSearchQuery(value: string): boolean {
    const input = value.trim();
    return Boolean(input && !/^[a-z][a-z0-9+.-]*:/i.test(input) && (!input.includes('.') || /\s/.test(input)));
}

export function isBoardroomSpecialistPage(value: string): boolean {
    const page = parseBoardroomPublicPage(value);
    return page !== undefined && specialistHosts.has(page.hostname);
}
