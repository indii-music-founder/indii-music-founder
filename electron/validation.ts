import { z } from 'zod';
import { IpcMainInvokeEvent } from 'electron';

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
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 127.0.0.0/8
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,  // 10.0.0.0/8
    /^192\.168\.\d{1,3}\.\d{1,3}$/,     // 192.168.0.0/16
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
    /^169\.254\.\d{1,3}\.\d{1,3}$/,     // 169.254.0.0/16 (Link Local)
    /^0\.0\.0\.0$/                      // Any
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

        // 2. Block Localhost explicitly
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
            return false;
        }

        // 3. Block Private IPv4 Literals
        if (PRIVATE_IP_RANGES_V4.some(regex => regex.test(hostname))) {
            return false;
        }

        // 4. Block Private IPv6 Literals
        if (PRIVATE_IP_RANGES_V6.some(regex => regex.test(hostname))) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}, {
    message: "Invalid URL: Must be a public HTTP/HTTPS URL. Local/Private IPs are blocked."
});

/**
 * Zod Schema for SFTP Upload
 * Prevents directory traversal sequences.
 * Allows absolute paths (necessary for file uploads) but blocks ".." abuse.
 */
export const SftpUploadSchema = z.object({
    localPath: z.string().refine((path) => {
        // Prevent directory traversal attacks
        return !path.includes('..');
    }, { message: "Local path cannot contain traversal (..)" }),

    remotePath: z.string().refine((path) => {
        // Basic sanity check for remote path
        return !path.includes('..');
    }, { message: "Remote path cannot contain traversal (..)" })
});

/**
 * Validates the sender of an IPC message.
 * Ensures the request originates from a trusted local file or the dev server.
 */
export function validateSender(event: IpcMainInvokeEvent) {
    const senderUrl = event.senderFrame?.url || '';

    // In production, the app is served from file://
    // In dev, it might be http://localhost:xxxx
    // We check specifically for our app's origins.

    // Note: process.env.VITE_DEV_SERVER_URL is available in Main process via env
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;

    const isFile = senderUrl.startsWith('file://');
    const isDev = devServerUrl && senderUrl.startsWith(devServerUrl);

    // Allow empty senderUrl in some test contexts if strictly needed,
    // but for security we default to strict.
    if (!isFile && !isDev) {
        console.warn(`[Security] Blocked IPC from untrusted origin: ${senderUrl}`);
        throw new Error('Unauthorized IPC Sender');
    }
}
