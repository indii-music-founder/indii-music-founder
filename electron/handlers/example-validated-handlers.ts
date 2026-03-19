/**
 * Example: Refactored IPC Handlers with Validation
 * 
 * This file shows how to migrate existing ipcMain.handle() calls
 * to use the secure validation utility.
 * 
 * BEFORE:
 * ```typescript
 * ipcMain.handle('file:read', async (event, path) => {
 *   return fs.readFile(path, 'utf-8');  // No validation! Path traversal possible!
 * });
 * ```
 * 
 * AFTER:
 * ```typescript
 * registerValidatedHandler('file:read',
 *   validators.object({
 *     path: validators.filePath({ allowedExtensions: ['txt', 'md'] }),
 *   }),
 *   async (event, { path }) => {
 *     return fs.readFile(path, 'utf-8');  // Safe! Input validated.
 *   }
 * );
 * ```
 */

import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import {
    validators,
    commonValidators,
    registerValidatedHandler,
    registerRateLimitedHandler,
} from './utils/ipc-validator';

// ============================================================================
// File Operations (High Risk - needs strict validation)
// ============================================================================

/**
 * Read file contents with path validation
 */
registerValidatedHandler(
    'file:read',
    validators.object({
        filePath: validators.filePath({
            allowedExtensions: ['txt', 'md', 'json', 'yaml', 'yml'],
            maxLength: 500,
        }),
        encoding: validators.optional(
            validators.oneOf(['utf-8', 'ascii', 'base64'] as const),
            'utf-8'
        ),
    }),
    async (event, { filePath, encoding }) => {
        // Additional security: resolve to absolute and check it's in allowed directory
        const resolvedPath = path.resolve(filePath);
        const allowedBase = path.resolve(process.cwd(), 'user-data');
        
        if (!resolvedPath.startsWith(allowedBase)) {
            throw new Error('Access denied: Path outside allowed directory');
        }

        return fs.readFile(resolvedPath, { encoding: encoding as BufferEncoding });
    }
);

/**
 * Write file with validation and rate limiting
 */
registerRateLimitedHandler(
    'file:write',
    validators.object({
        filePath: validators.filePath({
            allowedExtensions: ['txt', 'md', 'json'],
        }),
        content: validators.string({ maxLength: 1_000_000 }), // 1MB max
    }),
    async (event, { filePath, content }) => {
        const resolvedPath = path.resolve(filePath);
        const allowedBase = path.resolve(process.cwd(), 'user-data');
        
        if (!resolvedPath.startsWith(allowedBase)) {
            throw new Error('Access denied: Path outside allowed directory');
        }

        await fs.writeFile(resolvedPath, content, 'utf-8');
        return { success: true, path: resolvedPath };
    },
    { maxRequests: 30, windowMs: 60000 } // 30 writes per minute max
);

/**
 * List directory with validation
 */
registerValidatedHandler(
    'file:list',
    validators.object({
        directory: validators.string({ maxLength: 500 }),
    }),
    async (event, { directory }) => {
        const resolvedPath = path.resolve(directory);
        const allowedBase = path.resolve(process.cwd(), 'user-data');
        
        if (!resolvedPath.startsWith(allowedBase)) {
            throw new Error('Access denied: Path outside allowed directory');
        }

        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
        }));
    }
);

// ============================================================================
// User/Organization Operations
// ============================================================================

/**
 * Get user profile with ID validation
 */
registerValidatedHandler(
    'user:get-profile',
    validators.object({
        userId: commonValidators.userId,
    }),
    async (event, { userId }) => {
        // Your user profile fetching logic
        // The userId is guaranteed to be a valid format
        console.log(`Fetching profile for validated userId: ${userId}`);
        return { userId, displayName: 'User' };
    }
);

/**
 * Update user preferences
 */
registerValidatedHandler(
    'user:update-preferences',
    validators.object({
        userId: commonValidators.userId,
        preferences: validators.object({
            theme: validators.optional(validators.oneOf(['light', 'dark', 'system'] as const)),
            fontSize: validators.optional(validators.number({ min: 10, max: 24, integer: true })),
            language: validators.optional(validators.string({ minLength: 2, maxLength: 5 })),
            notifications: validators.optional(validators.boolean()),
        }, { strict: false }), // Allow extra preferences
    }),
    async (event, { userId, preferences }) => {
        console.log(`Updating preferences for ${userId}:`, preferences);
        return { success: true };
    }
);

/**
 * Get organization members with pagination
 */
registerValidatedHandler(
    'org:get-members',
    validators.object({
        orgId: commonValidators.orgId,
        limit: validators.optional(commonValidators.paginationLimit, 20),
        offset: validators.optional(commonValidators.paginationOffset, 0),
    }),
    async (event, { orgId, limit, offset }) => {
        console.log(`Fetching members for org ${orgId}, limit: ${limit}, offset: ${offset}`);
        return { members: [], total: 0 };
    }
);

// ============================================================================
// AI/Generation Operations (Rate limited to prevent abuse)
// ============================================================================

/**
 * Generate content with strict rate limiting
 */
registerRateLimitedHandler(
    'ai:generate',
    validators.object({
        prompt: validators.string({ minLength: 1, maxLength: 10000 }),
        model: validators.optional(
            validators.oneOf(['gemini-flash', 'gemini-pro'] as const),
            'gemini-flash'
        ),
        maxTokens: validators.optional(validators.number({ min: 1, max: 4096 }), 1024),
    }),
    async (event, { prompt, model, maxTokens }) => {
        console.log(`Generating with ${model}, prompt length: ${prompt.length}`);
        return { content: 'Generated content here' };
    },
    { maxRequests: 10, windowMs: 60000 } // 10 generations per minute
);

/**
 * Upload to knowledge base
 */
registerRateLimitedHandler(
    'knowledge:upload',
    validators.object({
        fileName: commonValidators.fileName,
        mimeType: validators.oneOf([
            'application/pdf',
            'text/plain',
            'text/markdown',
        ] as const),
        size: validators.number({ min: 1, max: 20_000_000 }), // 20MB max
    }),
    async (event, { fileName, mimeType, size }) => {
        console.log(`Uploading ${fileName} (${mimeType}, ${size} bytes)`);
        return { uploadId: 'upload-123' };
    },
    { maxRequests: 5, windowMs: 60000 } // 5 uploads per minute
);

// ============================================================================
// External URL Operations (Strict validation to prevent SSRF)
// ============================================================================

/**
 * Fetch external URL with strict host validation
 */
registerValidatedHandler(
    'external:fetch',
    validators.object({
        url: validators.url({
            protocols: ['https'], // HTTPS only
            allowedHosts: [
                'api.example.com',
                'cdn.example.com',
                // Add allowed hosts explicitly
            ],
        }),
    }),
    async (event, { url }) => {
        // Safe to fetch - URL is validated and host is whitelisted
        console.log(`Fetching validated URL: ${url}`);
        return { data: 'Response data' };
    }
);

// ============================================================================
// Auth Operations (Already implemented in auth.ts, but example here)
// ============================================================================

/**
 * Validate email format for login
 */
registerValidatedHandler(
    'auth:validate-email',
    validators.object({
        email: validators.email(),
    }),
    async (event, { email }) => {
        // Email is guaranteed to be valid format
        return { valid: true, email };
    }
);

// ============================================================================
// Export registered handlers
// ============================================================================

export function registerAllHandlers(): void {
    console.log('[IPC] All validated handlers registered');
}

export default { registerAllHandlers };
