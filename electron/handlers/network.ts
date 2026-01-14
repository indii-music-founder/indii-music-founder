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
import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Checks if an IP address is private or reserved.
 */
function isPrivateIP(ip: string): boolean {
    const family = net.isIP(ip);
    if (family === 4) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return false; // Should not happen if net.isIP passes

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
        // 100.64.0.0/10 (Carrier Grade NAT) - often used internally
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
        // Normalize IPv6 is hard without a library, but we can check prefixes
        // Standardize: remove brackets if present (though net.isIP usually expects bare)
        // net.isIP handles standard string representation

        // Loopback
        if (ip === '::1') return true;
        if (ip === '::') return true;

        // Unique Local (fc00::/7) -> fc, fd
        const lowerIp = ip.toLowerCase();
        if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;

        // Link-Local (fe80::/10) -> fe8, fe9, fea, feb
        if (lowerIp.startsWith('fe8') || lowerIp.startsWith('fe9') || lowerIp.startsWith('fea') || lowerIp.startsWith('feb')) return true;

        // Multicast (ff00::/8)
        if (lowerIp.startsWith('ff')) return true;

        // IPv4 Mapped (::ffff:0:0/96)
        // These often appear as ::ffff:192.168.1.1 or ::ffff:c0a8:0101
        if (lowerIp.includes('.')) {
             // Extract the IPv4 part from the end
             const lastColon = lowerIp.lastIndexOf(':');
             const ipv4Part = lowerIp.substring(lastColon + 1);
             if (net.isIP(ipv4Part) === 4) {
                 return isPrivateIP(ipv4Part);
             }
        }

        return false;
    }

    return false; // Not an IP
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
    // 1. Initial Blocklist (Defense in Depth - saves a DNS lookup)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '0.0.0.0') {
         throw new Error(`Security Violation: Access to localhost is denied.`);
    }
    if (hostname === '169.254.169.254') {
        throw new Error(`Security Violation: Access to Cloud Metadata services is denied.`);
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
    // 2. DNS Resolution
    try {
        // Use verbatim: true to get the address as configured in the system (IPv4/IPv6 preference)
        // We lookup BOTH usually, but lookup() returns the first one found.
        // For security, we should check if ANY address resolves to private.
        // But typical fetch usage depends on system resolver.
        const { address } = await dns.lookup(hostname, { verbatim: true });

        console.log(`[Network] DNS Resolved ${hostname} to ${address}`);

        if (isPrivateIP(address)) {
             throw new Error(`Security Violation: Domain '${hostname}' resolves to private IP ${address}.`);
        }

    } catch (error) {
        // If DNS fails, we can't fetch anyway, but let's rethrow properly
        if ((error as Error).message.includes('Security Violation')) {
            throw error;
        }
        // If it's just ENOTFOUND, let fetch fail naturally or block it?
        // Blocking it is safer.
        console.warn(`[Network] DNS Resolution failed for ${hostname}:`, error);
        // We allow the process to continue to fetch() only if we are sure it's not a security bypass.
        // But if we can't resolve it, how can fetch resolve it?
        // fetch might use a different resolver? Unlikely in Node/Electron.
        // Safe default: Fail open? NO. Fail closed.
        throw new Error(`Security Violation: Could not verify DNS for '${hostname}'.`);
    }
}

// Kept for backward compatibility if needed, but deprecated
export function validateSafeUrl(urlString: string): void {
     // This legacy function is insufficient for DNS Rebinding protection.
     // It is kept temporarily to avoid breaking changes if called synchronously elsewhere,
     // but the main IPC handler MUST use validateSafeUrlAsync.

     // Perform the basic static checks at least
     let url: URL;
     try {
        url = new URL(urlString);
     } catch(e) { throw new Error('Invalid URL'); }

     if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
         throw new Error('Security Violation: Access to localhost is denied.');
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
            // 3. SSRF Protection: Resolve DNS and check IP
            await validateSafeUrlAsync(validatedUrl);

            console.log(`[Network] Fetching Safe URL: ${validatedUrl}`);

            // 4. Fetch with redirect: 'error' to prevent open redirect bypasses to internal IPs
            // Note: Even with DNS check, redirects could lead to internal IPs.
            // fetch({ redirect: 'error' }) prevents following redirects entirely, which is the safest default for this utility.
            // 4. Fetch with redirect: 'error' (or 'manual') to prevent open redirect bypasses
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
