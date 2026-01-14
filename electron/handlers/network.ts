import { ipcMain } from 'electron';
import { z } from 'zod';
import { FetchUrlSchema } from '../validation';
import { validateSender } from '../utils/ipc-security';
import dns from 'node:dns';
import net from 'node:net';

/**
 * Checks if an IP address is private or reserved.
 */
function isPrivateIP(ip: string): boolean {
    const family = net.isIP(ip);
    if (family === 4) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return false;

        // 0.0.0.0/8 (Current network)
        if (parts[0] === 0) return true;
        // 127.0.0.0/8 (Loopback)
        if (parts[0] === 127) return true;
        // 10.0.0.0/8 (Private)
        if (parts[0] === 10) return true;
        // 172.16.0.0/12 (Private)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        // 192.168.0.0/16 (Private)
        if (parts[0] === 192 && parts[1] === 168) return true;
        // 169.254.0.0/16 (Link-Local)
        if (parts[0] === 169 && parts[1] === 254) return true;
        // 100.64.0.0/10 (Carrier Grade NAT)
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
        // 192.0.0.0/24 (IETF Protocol Assignments)
        if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
        // 192.0.2.0/24 (TEST-NET-1)
        if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
        // 198.18.0.0/15 (Benchmarking)
        if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return true;
        // 198.51.100.0/24 (TEST-NET-2)
        if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
        // 203.0.113.0/24 (TEST-NET-3)
        if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
        // 224.0.0.0/4 (Multicast)
        if (parts[0] >= 224) return true;

        return false;
    } else if (family === 6) {
        // Normalize IPv6 check (simplified)
        if (ip === '::1') return true;
        if (ip === '::') return true;

        const lowerIp = ip.toLowerCase();
        // Unique Local (fc00::/7)
        if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;
        // Link-Local (fe80::/10)
        if (lowerIp.startsWith('fe8') || lowerIp.startsWith('fe9') || lowerIp.startsWith('fea') || lowerIp.startsWith('feb')) return true;
        // Multicast (ff00::/8)
        if (lowerIp.startsWith('ff')) return true;

        // IPv4 Mapped (::ffff:0:0/96)
        if (lowerIp.includes('.')) {
            const lastColon = lowerIp.lastIndexOf(':');
            const ipv4Part = lowerIp.substring(lastColon + 1);
            if (net.isIP(ipv4Part) === 4) {
                return isPrivateIP(ipv4Part);
            }
        }
        return false;
    }
    return false;
}

/**
 * Validates that a URL is safe to fetch by resolving DNS.
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
    if (!hostname) throw new Error('Invalid URL: Missing hostname');

    // 1. Initial Blocklist (Defense in Depth)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '0.0.0.0') {
        throw new Error(`Security Violation: Access to localhost is denied.`);
    }
    if (hostname === '169.254.169.254') {
        throw new Error(`Security Violation: Access to Cloud Metadata services is denied.`);
    }

    // 2. Resolve DNS
    try {
        const { address } = await dns.promises.lookup(hostname);

        // 3. Validate Resolved IP
        if (isPrivateIP(address)) {
            throw new Error(`Security Violation: Domain '${hostname}' resolves to private IP ${address}.`);
        }
    } catch (error: any) {
        if (error.message.startsWith('Security Violation')) throw error;
        // Fail closed if DNS resolution fails
        throw new Error(`Security Violation: Could not verify DNS for '${hostname}': ${error.message}`);
    }
}

/**
 * @deprecated Use validateSafeUrlAsync instead. Kept for backward compatibility.
 */
export function validateSafeUrl(urlString: string): void {
    let url: URL;
    try {
        url = new URL(urlString);
    } catch (e) { throw new Error('Invalid URL'); }

    const hostname = url.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '[::1]') {
        throw new Error('Security Violation: Access to localhost is denied.');
    }
    if (hostname === '169.254.169.254') {
        throw new Error('Security Violation: Access to Cloud Metadata services is denied.');
    }
}

export function registerNetworkHandlers() {
    ipcMain.handle('net:fetch-url', async (event, url: string) => {
        try {
            validateSender(event);
            const validatedUrl = FetchUrlSchema.parse(url);

            console.log(`[Network] Validating Request: ${url}`);
            await validateSafeUrlAsync(validatedUrl);

            console.log(`[Network] Fetching Safe URL: ${validatedUrl}`);
            const response = await fetch(validatedUrl, { redirect: 'error' });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            const text = await response.text();
            return text;
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('[Network] Validation failed:', error.errors);
                throw new Error(`Invalid URL: ${error.errors[0].message}`);
            }
            console.error('[Network] Fetch failed:', error);
            throw new Error(`Network Request Failed: ${(error as Error).message}`);
        }
    });
}
