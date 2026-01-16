import { z } from 'zod';
import { isIP } from 'node:net';

/**
 * Zod Schema for URL validation (Defense against SSRF)
 * Blocks:
 * - Non-HTTP/HTTPS protocols
 * - Localhost / Loopback (IPv4 & IPv6)
 * - Private RFC1918 ranges
 * - Link-local / Special ranges
 * - AWS/Cloud metadata IPs
 */
const PRIVATE_IP_RANGES_V4 = [
    /^127\./,                           // 127.0.0.0/8
    /^10\./,                            // 10.0.0.0/8
    /^192\.168\./,                      // 192.168.0.0/16
    /^172\.(1[6-9]|2\d|3[0-1])\./,      // 172.16.0.0/12
    /^169\.254\./,                      // 169.254.0.0/16 (Link Local)
    /^0\.0\.0\.0$/,                     // Any
    /^0/                                // Block leading zeros (octal bypass attempts)
];

// Basic IPv6 loopback and private range checks
// This is not exhaustive but catches common "localhost" bypasses
const PRIVATE_IP_RANGES_V6 = [
    /^\[?::1\]?$/,       // Loopback
    /^\[?fc00:/i,        // Unique Local Address (fc00::/7)
    /^\[?fe80:/i         // Link Local (fe80::/10)
];

export const FetchUrlSchema = z.string().url().refine((url) => {
    try {
        const parsed = new URL(url);

        // 1. Protocol Check
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
        }

        const hostname = parsed.hostname;

        // 2. Block Localhost explicitly (Works for domains too)
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
            return false;
        }

        // 3. IP-Specific Checks
        // Only apply these if it looks like an IP or Node says it is an IP.
        // This prevents blocking domains like "10.com" or "127.com".

        // Handle IPv6 brackets for isIP check
        let cleanHostname = hostname;
        if (hostname.startsWith('[') && hostname.endsWith(']')) {
            cleanHostname = hostname.slice(1, -1);
        }

        const ipVersion = isIP(cleanHostname);

        if (ipVersion !== 0) {
            // It IS an IP address (v4 or v6)

            if (ipVersion === 4) {
                 if (PRIVATE_IP_RANGES_V4.some(regex => regex.test(cleanHostname))) {
                     return false;
                 }
            }

            if (ipVersion === 6) {
                 // Check the raw hostname (with brackets potentially) against regexes that handle them
                 // OR check cleanHostname. Our regexes allow optional brackets.
                 if (PRIVATE_IP_RANGES_V6.some(regex => regex.test(hostname))) {
                     return false;
                 }
            }

            // Extra safety for things that look like IPs but might sneak through regex
             if (cleanHostname.startsWith('0') && cleanHostname !== '0.0.0.0') return false;
        } else {
             // It is a DOMAIN name (e.g. example.com, 10.com)
             // However, some malformed IPs might fail isIP but be interpreted as IPs by libraries.
             // We trust validateSafeUrlAsync (DNS resolution) to catch those later.
             // But we can check for common "IP-like" bypasses that are definitely not valid domains.
        }

        return true;
    } catch {
        return false;
    }
}, {
    message: "Invalid URL: Must be a public HTTP/HTTPS URL. Local/Private IPs are blocked."
});

export const AgentActionSchema = z.object({
    action: z.enum(['click', 'type', 'scroll', 'wait', 'hover', 'press', 'extract']),
    selector: z.string().min(1),
    text: z.string().optional()
});

export const AgentNavigateSchema = z.object({
    url: FetchUrlSchema
});

export const SFTPConfigSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().positive().optional().default(22),
    username: z.string().min(1),
    password: z.string().optional(),
    privateKey: z.string().optional()
}).refine(data => data.password || data.privateKey, {
    message: "Either password or privateKey must be provided"
});

export const CredentialSchema = z.object({
    id: z.string().min(1),
    creds: z.record(z.string().optional())
});

export const CredentialIdSchema = z.string().min(1).max(256).regex(/^[a-zA-Z0-9_-]+$/, "ID must be alphanumeric, dashes, or underscores");

export const AudioAnalyzeSchema = z.string().min(1).refine((path) => {
    // Prevent traversal
    if (path.includes('..')) return false;
    // Allow typical audio extensions
    return /\.(wav|mp3|flac|ogg|aiff|m4a)$/i.test(path);
}, { message: "Invalid audio file path (Traversal detected or unsupported extension)" });

export const AudioLookupSchema = z.string().min(8).regex(/^[a-fA-F0-9]+$/, "Hash must be a hex string");

export const DistributionStageReleaseSchema = z.object({
    releaseId: z.string().uuid(),
    files: z.array(z.object({
        type: z.string(),
        data: z.string(), // base64 or path
        name: z.string().refine(name => !name.includes('..') && !name.startsWith('/') && !name.includes('\\'), {
            message: "File name must not contain path traversal characters"
        })
    }))
});

export const SftpUploadSchema = z.object({
    localPath: z.string().min(1),
    remotePath: z.string().min(1)
}).refine((data) => {
    const hasTraversal = (path: string) => path.includes('..');
    return !hasTraversal(data.localPath) && !hasTraversal(data.remotePath);
}, { message: "Path traversal detected in local or remote path" });
