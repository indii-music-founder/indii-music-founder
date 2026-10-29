/** Rebuild the external callback path stripped by Cloud Functions/emulator routing. */
export function mcpMessageUrl(host: string, emulator: boolean, projectId?: string): string {
    const url = new URL(`${emulator ? 'http' : 'https'}://${host}`);
    const normalizedHost = host.toLowerCase().replace(emulator ? /:80$/ : /:443$/, '');
    if (url.host !== normalizedHost || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error('Invalid MCP gateway host.');
    }
    if (emulator) {
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
            !projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
            throw new Error('MCP emulator callback requires loopback and a valid project ID.');
        }
        return `http://${url.host}/${projectId}/us-central1/mcpEndpoint/message`;
    }
    const prefix = url.hostname.endsWith('.cloudfunctions.net') ? '/mcpEndpoint' : '';
    return `https://${url.host}${prefix}/message`;
}
