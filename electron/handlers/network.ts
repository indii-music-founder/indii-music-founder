import { ipcMain } from 'electron';
import { z } from 'zod';
import { FetchUrlSchema } from '../validation';
import { validateSender } from '../utils/ipc-security';
import dns from 'node:dns';
import net from 'node:net';

/**
 * Expands an IPv6 address to its full 32-digit hexadecimal representation.
 * Handles :: expansion and IPv4-mapped addresses.
 */
export function expandIPv6(ip: string): string {
    // 1. Handle embedded IPv4 (e.g. ::ffff:192.168.1.1)
    if (ip.includes('.')) {
        const lastColon = ip.lastIndexOf(':');
        const ipv4 = ip.substring(lastColon + 1);
        if (net.isIP(ipv4) === 4) {
            const parts = ipv4.split('.').map(Number);
            const hex = parts.map(p => p.toString(16).padStart(2, '0')).join('');
            const p1 = hex.substring(0, 4);
            const p2 = hex.substring(4, 8);
            const prefix = ip.substring(0, lastColon);
            return expandIPv6(`${prefix}:${p1}:${p2}`);
        }
    }

    // 2. Expand "::"
    const parts = ip.split('::');
    if (parts.length > 2) return ip; // Invalid

    const head = parts[0] ? parts[0].split(':') : [];
    const tail = parts.length > 1 ? (parts[1] ? parts[1].split(':') : []) : [];

    // Total groups should be 8
    const zerosToFill = 8 - (head.length + tail.length);
    const zeros = new Array(zerosToFill).fill('0000');

    const groups = [...head, ...zeros, ...tail];

    return groups.map(g => g.padStart(4, '0')).join(':').toLowerCase();
}

/**
 * Checks if an IP address is private or reserved.
 */
export function isPrivateIP(ip: string): boolean {
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
        // Expand IPv6 to full 32-digit hex form
        const expanded = expandIPv6(ip);

        // Loopback (::1) -> 0000:0000:0000:0000:0000:0000:0000:0001
        if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true;

        // Unspecified (::) -> 0000:0000:0000:0000:0000:0000:0000:0000
        if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

        // Unique Local (fc00::/7) -> fc.. or fd..
        if (expanded.startsWith('fc') || expanded.startsWith('fd')) return true;

        // Link-Local (fe80::/10) -> fe8., fe9., fea., feb.
        const firstGroup = expanded.substring(0, 4);
        if (['fe8', 'fe9', 'fea', 'feb'].some(prefix => firstGroup.startsWith(prefix))) return true;

        // Multicast (ff00::/8) -> ff..
        if (expanded.startsWith('ff')) return true;

        // IPv4 Mapped (::ffff:0:0/96)
        // 0000:0000:0000:0000:0000:ffff:xxxx:xxxx
        if (expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) {
            const lastPart = expanded.substring(30);
            const parts = lastPart.split(':');
            const p1 = parseInt(parts[0], 16);
            const p2 = parseInt(parts[1], 16);
            const ip4 = `${(p1 >> 8) & 255}.${p1 & 255}.${(p2 >> 8) & 255}.${p2 & 255}`;
            return isPrivateIP(ip4);
        }

        // IPv4 Compatible (deprecated but exists) ::0.0.0.0 (::/96)
        // 0000:0000:0000:0000:0000:0000:xxxx:xxxx
        if (expanded.startsWith('0000:0000:0000:0000:0000:0000:')) {
            const lastPart = expanded.substring(30);
            if (lastPart !== '0000:0001' && lastPart !== '0000:0000') {
                const parts = lastPart.split(':');
                const p1 = parseInt(parts[0], 16);
                const p2 = parseInt(parts[1], 16);
                const ip4 = `${(p1 >> 8) & 255}.${p1 & 255}.${(p2 >> 8) & 255}.${p2 & 255}`;
                return isPrivateIP(ip4);
            }
        }
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
        const addresses = await dns.promises.lookup(hostname, { all: true });

        // 3. Validate ALL Resolved IPs
        for (const { address } of addresses) {
            if (isPrivateIP(address)) {
                throw new Error(`Security Violation: Domain '${hostname}' resolves to private IP ${address}.`);
            }
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
