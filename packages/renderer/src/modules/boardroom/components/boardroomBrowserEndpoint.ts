interface BoardroomBrowserEndpointOptions {
    enabled: boolean;
    configuredEndpoint?: string;
    isDev: boolean;
    hostname: string;
}

/** Resolve the optional hosted browser endpoint without baking a deployment URL into the renderer. */
export function resolveBoardroomBrowserEndpoint({
    enabled,
    configuredEndpoint,
    isDev,
    hostname,
}: BoardroomBrowserEndpointOptions): string | undefined {
    if (!enabled) return undefined;
    if (isDev && ['localhost', '127.0.0.1'].includes(hostname)) return 'ws://127.0.0.1:4245/boardroom';
    if (!configuredEndpoint) return undefined;

    try {
        const endpoint = new URL(configuredEndpoint);
        if (endpoint.protocol !== 'wss:' || endpoint.username || endpoint.password
            || endpoint.search || endpoint.hash || endpoint.pathname !== '/boardroom') {
            return undefined;
        }
        return endpoint.href;
    } catch {
        return undefined;
    }
}
