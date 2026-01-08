import { ipcMain } from 'electron';
import { FetchUrlSchema, validateSender } from '../validation';

/**
 * Validates that a URL is safe to fetch.
 *
 * Policy:
 * 1. Must use http or https protocol.
 * 2. Must not resolve to private/reserved IP ranges (localhost, 127.0.0.0/8, 10.x, 192.168.x, 172.16.x, 169.254.x, 0.0.0.0).
 * 3. Must be a valid URL.
 */
export function validateSafeUrl(urlString: string): void {
    let url: URL;
    try {
        url = new URL(urlString);
    } catch (e) {
        throw new Error('Invalid URL format');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`Security Violation: Protocol '${url.protocol}' is not allowed. Only HTTP/HTTPS are permitted.`);
    }

    // Normalize hostname by removing trailing dot if present
    const hostname = url.hostname.replace(/\.$/, '');

    // Block Localhost aliases
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '[::1]') {
        throw new Error(`Security Violation: Access to localhost is denied.`);
    }

    // Block Metadata Services (AWS, GCP, Azure) - Redundant but explicit check
    if (hostname === '169.254.169.254') {
        throw new Error(`Security Violation: Access to Cloud Metadata services is denied.`);
    }

    // Private IP blocking (IPv4)
    // 127.0.0.0/8 (Loopback)
    // 10.0.0.0/8
    // 172.16.0.0/12
    // 192.168.0.0/16
    // 169.254.0.0/16 (Link-Local)
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
        const ip = parts.map(Number);

        // Loopback (127.x.x.x)
        if (ip[0] === 127) {
            throw new Error(`Security Violation: Access to loopback address (127.x.x.x) is denied.`);
        }

        // Private Network (10.x.x.x)
        if (ip[0] === 10) {
            throw new Error(`Security Violation: Access to private network (10.x.x.x) is denied.`);
        }

        // Private Network (192.168.x.x)
        if (ip[0] === 192 && ip[1] === 168) {
            throw new Error(`Security Violation: Access to private network (192.168.x.x) is denied.`);
        }

        // Private Network (172.16.x.x - 172.31.x.x)
        if (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) {
            throw new Error(`Security Violation: Access to private network (172.16-31.x.x) is denied.`);
        }

        // Link-Local (169.254.x.x)
        if (ip[0] === 169 && ip[1] === 254) {
             throw new Error(`Security Violation: Access to Link-Local address (169.254.x.x) is denied.`);
        }
    }
}

export function registerNetworkHandlers() {
    ipcMain.handle('net:fetch-url', async (event, url: string) => {
        try {
            console.log(`[Network] Validating Request: ${url}`);

            // Validate URL before fetching
            validateSafeUrl(url);

            console.log(`[Network] Fetching Safe URL: ${url}`);

            // Fetch with redirect: 'error' to prevent open redirect bypasses to internal IPs
            const response = await fetch(url, { redirect: 'error' });
            // 1. Validate Sender (Anti-Hijack)
            validateSender(event);

            // 2. Defense in Depth: Validate URL (Anti-SSRF)
            const validUrl = FetchUrlSchema.parse(url);

            console.log(`[Network] Fetching: ${validUrl}`);
            const response = await fetch(validUrl);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            // We only need the text content for the AI to analyze (HTML/Terms)
            const text = await response.text();
            return text;
        } catch (error) {
            console.error('[Network] Fetch failed:', error);
            // Re-throw with clear message
            throw new Error(`Network Request Failed: ${(error as Error).message}`);
        }
    });
}
