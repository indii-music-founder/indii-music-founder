/** Resolve the remote gateway from explicit configuration or the active Firebase project. */
export function resolveMcpEndpoint(configured: unknown, projectId: unknown, development: boolean): string {
    let endpoint: string;
    if (typeof configured === 'string' && configured.trim()) {
        endpoint = configured.trim();
    } else {
        if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
            throw new Error('MCP requires a valid Firebase project ID or VITE_MCP_ENDPOINT.');
        }
        endpoint = development
            ? `http://127.0.0.1:5001/${projectId}/us-central1/mcpEndpoint`
            : `https://us-central1-${projectId}.cloudfunctions.net/mcpEndpoint`;
    }
    const url = new URL(endpoint);
    const localHttp = development && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!localHttp && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) {
        throw new Error('MCP endpoint must use HTTPS (loopback HTTP is development-only) without credentials, query or fragment.');
    }
    return url.href.replace(/\/+$/, '');
}

/** The SSE server cannot redirect a bearer-bearing request to another origin/path. */
export function assertMcpTransportDestination(input: string | URL, endpoint: string): void {
    const base = new URL(endpoint);
    const target = new URL(input);
    const prefix = base.pathname.replace(/\/+$/, '');
    if (target.origin !== base.origin || target.username || target.password || target.hash ||
        ![`${prefix}/sse`, `${prefix}/message`].includes(target.pathname)) {
        throw new Error('MCP transport destination is outside the configured gateway.');
    }
}
