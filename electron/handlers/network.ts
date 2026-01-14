import { ipcMain } from 'electron';
import { z } from 'zod';
import { FetchUrlSchema } from '../validation';
import { validateSender } from '../utils/ipc-security';
import dns from 'dns';

/**
 * Checks if an IP address is private, loopback, or link-local.
 */
export function isPrivateIP(ip: string): boolean {
    // IPv6 Loopback
    if (ip === '::1') return true;

    // IPv6 Unique Local (fc00::/7) or Link-Local (fe80::/10) - Simple string checks for now
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd') || ip.toLowerCase().startsWith('fe80')) {
        return true;
    }

    const parts = ip.split('.');
    if (parts.length !== 4) return false; // Not a valid IPv4 (assuming validated by dns lookup or caller)

    const octets = parts.map(p => parseInt(p, 10));

    // 0.0.0.0/8 (Current network)
    if (octets[0] === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) return true;

    // 10.0.0.0/8 (Private)
    if (octets[0] === 10) return true;

    // 192.168.0.0/16 (Private)
    if (octets[0] === 192 && octets[1] === 168) return true;

    // 172.16.0.0/12 (Private)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;

    // 169.254.0.0/16 (Link-Local)
    if (octets[0] === 169 && octets[1] === 254) return true;

    return false;
}

/**
 * Validates that a URL is safe to fetch by resolving its DNS.
 *
 * Policy:
 * 1. Must use http or https protocol.
 * 2. Must not resolve to private/reserved IP ranges.
 */
export async function validateSafeUrlAsync(urlString: string): Promise<void> {
    let url: URL;
    try {
        url = new URL(urlString);
    } catch (e) {
        throw new Error('Invalid URL format');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`Security Violation: Protocol '${url.protocol}' is not allowed. Only HTTP/HTTPS are permitted.`);
    }

    const hostname = url.hostname;

    // Block empty hostname
    if (!hostname) throw new Error('Invalid URL: Missing hostname');

    // 1. Resolve DNS
    try {
        const { address } = await dns.promises.lookup(hostname);

        // 2. Validate Resolved IP
        if (isPrivateIP(address)) {
            throw new Error(`Security Violation: Resolved IP ${address} is a private address.`);
        }
    } catch (error: any) {
        // If DNS lookup fails, fail secure
        // Exception: Propagate the Security Violation we just threw
        if (error.message.startsWith('Security Violation')) throw error;

        throw new Error(`DNS Lookup Failed for ${hostname}: ${error.message}`);
    }
}

/**
 * @deprecated Use validateSafeUrlAsync instead. Kept for backward compatibility with tests.
 * This does NOT perform DNS resolution and is vulnerable to DNS rebinding.
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

    const hostname = url.hostname.replace(/\.$/, '');

    // Manual string checks (Legacy)
     if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '[::1]') {
        throw new Error(`Security Violation: Access to localhost is denied.`);
    }

    if (hostname === '169.254.169.254') {
        throw new Error(`Security Violation: Access to Cloud Metadata services is denied.`);
    }

    if (isPrivateIP(hostname)) {
         if (hostname.startsWith('127.')) throw new Error(`Security Violation: Access to loopback address (127.x.x.x) is denied.`);
         throw new Error(`Security Violation: Access to private network is denied.`);
    }
}

export function registerNetworkHandlers() {
    ipcMain.handle('net:fetch-url', async (event, url: string) => {
        try {
            // 1. Validate Sender (Anti-Hijack)
            validateSender(event);

            // 2. Validate Input Schema (Defense in Depth)
            const validatedUrl = FetchUrlSchema.parse(url);

            console.log(`[Network] Validating Request: ${url}`);

            // 3. SSRF Protection: Validate URL before fetching
            // Checks protocol, localhost, and private IP ranges via DNS resolution
            await validateSafeUrlAsync(validatedUrl);

            console.log(`[Network] Fetching Safe URL: ${validatedUrl}`);

            // 4. Fetch with redirect: 'error' to prevent open redirect bypasses to internal IPs
            // Note: Even with DNS check, redirects could lead to internal IPs.
            // fetch({ redirect: 'error' }) prevents following redirects entirely, which is the safest default for this utility.
            const response = await fetch(validatedUrl, { redirect: 'error' });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            // We only need the text content for the AI to analyze (HTML/Terms)
            const text = await response.text();
            return text;
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('[Network] Validation failed:', error.errors);
                throw new Error(`Invalid URL: ${error.errors[0].message}`);
            }
            console.error('[Network] Fetch failed:', error);
            // Re-throw with clear message
            throw new Error(`Network Request Failed: ${(error as Error).message}`);
        }
    });
}
