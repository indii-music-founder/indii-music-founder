import log from 'electron-log';
/**
 * IPC Handler Validation Utility
 * 
 * Provides input validation and sanitization for Electron IPC handlers.
 * All ipcMain.handle() calls should use these validators.
 * 
 * Security principles:
 * 1. Validate all input types
 * 2. Sanitize strings to prevent injection
 * 3. Limit array/object sizes to prevent DoS
 * 4. Whitelist allowed values where possible
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';

// ============================================================================
// Types
// ============================================================================

type ValidatorFn<T> = (value: unknown) => T;

export interface ValidationResult<T> {
    success: boolean;
    value?: T;
    error?: string;
}

export interface ValidatorOptions {
    required?: boolean;
    default?: unknown;
}

// ============================================================================
// Core Validators
// ============================================================================

export const validators = {
    /**
     * Validate string input
     */
    string(options: {
        minLength?: number;
        maxLength?: number;
        pattern?: RegExp;
        allowEmpty?: boolean;
        sanitize?: boolean;
    } = {}): ValidatorFn<string> {
        const {
            minLength = 0,
            maxLength = 10000,
            pattern,
            allowEmpty = false,
            sanitize = true,
        } = options;

        return (value: unknown): string => {
            if (typeof value !== 'string') {
                throw new Error(`Expected string, got ${typeof value}`);
            }

            let str = value;

            // Sanitize if enabled (remove control characters, trim)
            if (sanitize) {
                str = str
                    // eslint-disable-next-line no-control-regex
                    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
                    .trim();
            }

            if (!allowEmpty && str.length === 0) {
                throw new Error('String cannot be empty');
            }

            if (str.length < minLength) {
                throw new Error(`String must be at least ${minLength} characters`);
            }

            if (str.length > maxLength) {
                throw new Error(`String cannot exceed ${maxLength} characters`);
            }

            if (pattern && !pattern.test(str)) {
                throw new Error(`String does not match required pattern`);
            }

            return str;
        };
    },

    /**
     * Validate number input
     */
    number(options: {
        min?: number;
        max?: number;
        integer?: boolean;
        positive?: boolean;
    } = {}): ValidatorFn<number> {
        const { min, max, integer = false, positive = false } = options;

        return (value: unknown): number => {
            let num: number;

            if (typeof value === 'number') {
                num = value;
            } else if (typeof value === 'string') {
                num = parseFloat(value);
            } else {
                throw new Error(`Expected number, got ${typeof value}`);
            }

            if (isNaN(num) || !isFinite(num)) {
                throw new Error('Invalid number');
            }

            if (integer && !Number.isInteger(num)) {
                throw new Error('Expected integer');
            }

            if (positive && num < 0) {
                throw new Error('Expected positive number');
            }

            if (min !== undefined && num < min) {
                throw new Error(`Number must be at least ${min}`);
            }

            if (max !== undefined && num > max) {
                throw new Error(`Number cannot exceed ${max}`);
            }

            return num;
        };
    },

    /**
     * Validate boolean input
     */
    boolean(): ValidatorFn<boolean> {
        return (value: unknown): boolean => {
            if (typeof value === 'boolean') {
                return value;
            }
            if (value === 'true' || value === 1) {
                return true;
            }
            if (value === 'false' || value === 0) {
                return false;
            }
            throw new Error(`Expected boolean, got ${typeof value}`);
        };
    },

    /**
     * Validate enum/whitelist values
     */
    oneOf<T extends string | number>(allowedValues: readonly T[]): ValidatorFn<T> {
        return (value: unknown): T => {
            if (!allowedValues.includes(value as T)) {
                throw new Error(
                    `Invalid value. Allowed: ${allowedValues.join(', ')}`
                );
            }
            return value as T;
        };
    },

    /**
     * Validate array input
     */
    array<T>(itemValidator: ValidatorFn<T>, options: {
        minLength?: number;
        maxLength?: number;
    } = {}): ValidatorFn<T[]> {
        const { minLength = 0, maxLength = 1000 } = options;

        return (value: unknown): T[] => {
            if (!Array.isArray(value)) {
                throw new Error(`Expected array, got ${typeof value}`);
            }

            if (value.length < minLength) {
                throw new Error(`Array must have at least ${minLength} items`);
            }

            if (value.length > maxLength) {
                throw new Error(`Array cannot exceed ${maxLength} items`);
            }

            return value.map((item, index) => {
                try {
                    return itemValidator(item);
                } catch (e) {
                    throw new Error(`Invalid item at index ${index}: ${e}`);
                }
            });
        };
    },

    /**
     * Validate object with specific schema
     */
    object<T extends Record<string, ValidatorFn<unknown>>>(
        schema: T,
        options: { strict?: boolean } = {}
    ): ValidatorFn<{ [K in keyof T]: ReturnType<T[K]> }> {
        const { strict = true } = options;

        return (value: unknown): { [K in keyof T]: ReturnType<T[K]> } => {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                throw new Error(`Expected object, got ${typeof value}`);
            }

            const obj = value as Record<string, unknown>;
            const result: Record<string, unknown> = {};

            // Validate known keys
            for (const [key, validator] of Object.entries(schema)) {
                try {
                    result[key] = validator(obj[key]);
                } catch (e) {
                    throw new Error(`Invalid field '${key}': ${e}`);
                }
            }

            // Check for unexpected keys in strict mode
            if (strict) {
                const allowedKeys = new Set(Object.keys(schema));
                const extraKeys = Object.keys(obj).filter(k => !allowedKeys.has(k));
                if (extraKeys.length > 0) {
                    throw new Error(`Unexpected fields: ${extraKeys.join(', ')}`);
                }
            }

            return result as { [K in keyof T]: ReturnType<T[K]> };
        };
    },

    /**
     * Make a validator optional
     */
    optional<T>(validator: ValidatorFn<T>, defaultValue?: T): ValidatorFn<T | undefined> {
        return (value: unknown): T | undefined => {
            if (value === undefined || value === null) {
                return defaultValue;
            }
            return validator(value);
        };
    },

    /**
     * Validate file path (prevent path traversal)
     */
    filePath(options: {
        allowedExtensions?: string[];
        maxLength?: number;
    } = {}): ValidatorFn<string> {
        const { allowedExtensions, maxLength = 500 } = options;

        return (value: unknown): string => {
            if (typeof value !== 'string') {
                throw new Error(`Expected string path, got ${typeof value}`);
            }

            if (value.length > maxLength) {
                throw new Error(`Path too long (max ${maxLength})`);
            }

            // Prevent path traversal
            if (value.includes('..') || value.includes('~')) {
                throw new Error('Path traversal not allowed');
            }

            // Check for null bytes (can bypass checks in some systems)
            if (value.includes('\0')) {
                throw new Error('Invalid path characters');
            }

            // Validate extension if specified
            if (allowedExtensions && allowedExtensions.length > 0) {
                const ext = value.split('.').pop()?.toLowerCase();
                if (!ext || !allowedExtensions.includes(ext)) {
                    throw new Error(
                        `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`
                    );
                }
            }

            return value;
        };
    },

    /**
     * Validate URL
     */
    url(options: {
        protocols?: string[];
        allowedHosts?: string[];
    } = {}): ValidatorFn<string> {
        const { protocols = ['https', 'http'], allowedHosts } = options;

        return (value: unknown): string => {
            if (typeof value !== 'string') {
                throw new Error(`Expected URL string, got ${typeof value}`);
            }

            let url: URL;
            try {
                url = new URL(value);
            } catch {
                throw new Error('Invalid URL format');
            }

            const protocol = url.protocol.replace(':', '');
            if (!protocols.includes(protocol)) {
                throw new Error(`Invalid protocol. Allowed: ${protocols.join(', ')}`);
            }

            if (allowedHosts && !allowedHosts.includes(url.hostname)) {
                throw new Error(`Host not allowed: ${url.hostname}`);
            }

            return value;
        };
    },

    /**
     * Validate email address
     */
    email(): ValidatorFn<string> {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        return (value: unknown): string => {
            if (typeof value !== 'string') {
                throw new Error(`Expected email string, got ${typeof value}`);
            }

            const email = value.trim().toLowerCase();

            if (!emailPattern.test(email)) {
                throw new Error('Invalid email format');
            }

            if (email.length > 254) {
                throw new Error('Email too long');
            }

            return email;
        };
    },
};

// ============================================================================
// Secure IPC Handler Wrapper
// ============================================================================

type HandlerFn<TArgs, TReturn> = (
    event: IpcMainInvokeEvent,
    args: TArgs
) => Promise<TReturn> | TReturn;

/**
 * Create a validated IPC handler.
 * 
 * Usage:
 * ```typescript
 * ipcMain.handle('my-channel', createValidatedHandler(
 *   validators.object({
 *     userId: validators.string({ maxLength: 100 }),
 *     count: validators.number({ min: 1, max: 100 }),
 *   }),
 *   async (event, { userId, count }) => {
 *     // Handler logic with validated inputs
 *     return result;
 *   }
 * ));
 * ```
 */
export function createValidatedHandler<TArgs, TReturn>(
    argsValidator: ValidatorFn<TArgs>,
    handler: HandlerFn<TArgs, TReturn>
): (event: IpcMainInvokeEvent, args: unknown) => Promise<TReturn> {
    return async (event: IpcMainInvokeEvent, args: unknown): Promise<TReturn> => {
        try {
            // Validate inputs
            const validatedArgs = argsValidator(args);

            // Call handler with validated args
            return await handler(event, validatedArgs);
        } catch (error) {
            // Log validation failures for security monitoring
            log.error(
                `[IPC Security] Validation failed:`,
                error instanceof Error ? error.message : error
            );

            // Throw a generic error to avoid leaking validation details
            throw new Error('Invalid request parameters');
        }
    };
}

/**
 * Register a validated IPC handler.
 * 
 * Usage:
 * ```typescript
 * registerValidatedHandler('file:open', 
 *   validators.object({
 *     path: validators.filePath({ allowedExtensions: ['txt', 'md'] }),
 *   }),
 *   async (event, { path }) => {
 *     return await fs.readFile(path, 'utf-8');
 *   }
 * );
 * ```
 */
export function registerValidatedHandler<TArgs, TReturn>(
    channel: string,
    argsValidator: ValidatorFn<TArgs>,
    handler: HandlerFn<TArgs, TReturn>
): void {
    ipcMain.handle(channel, createValidatedHandler(argsValidator, handler));
    log.info(`[IPC] Registered validated handler: ${channel}`);
}

// ============================================================================
// Pre-built Validators for Common Patterns
// ============================================================================

export const commonValidators = {
    /** User ID (Firebase UID format) */
    userId: validators.string({
        minLength: 1,
        maxLength: 128,
        pattern: /^[a-zA-Z0-9_-]+$/,
    }),

    /** Organization ID */
    orgId: validators.string({
        minLength: 1,
        maxLength: 128,
        pattern: /^[a-zA-Z0-9_-]+$/,
    }),

    /** Project ID */
    projectId: validators.string({
        minLength: 1,
        maxLength: 128,
        pattern: /^[a-zA-Z0-9_-]+$/,
    }),

    /** Safe filename (no path components) */
    fileName: validators.string({
        minLength: 1,
        maxLength: 255,
        pattern: /^[^/\\:*?"<>|]+$/,
    }),

    /** Pagination limit */
    paginationLimit: validators.number({
        min: 1,
        max: 100,
        integer: true,
    }),

    /** Pagination offset */
    paginationOffset: validators.number({
        min: 0,
        integer: true,
    }),
};

// ============================================================================
// Rate Limiting for IPC Handlers
// ============================================================================

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

const rateLimiters = new Map<string, Map<string, number[]>>();

/**
 * Check if a request should be rate limited.
 * 
 * @param channel - IPC channel name
 * @param identifier - Unique identifier (e.g., webContents.id)
 * @param config - Rate limit configuration
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
    channel: string,
    identifier: string,
    config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }
): boolean {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create rate limiter for this channel
    if (!rateLimiters.has(channel)) {
        rateLimiters.set(channel, new Map());
    }
    const channelLimiter = rateLimiters.get(channel)!;

    // Get request timestamps for this identifier
    const timestamps = channelLimiter.get(identifier) || [];

    // Filter to only requests within the window
    const recentRequests = timestamps.filter(t => t > windowStart);

    if (recentRequests.length >= config.maxRequests) {
        log.warn(
            `[IPC Security] Rate limit exceeded: ${channel} from ${identifier}`
        );
        return false;
    }

    // Add current request
    recentRequests.push(now);
    channelLimiter.set(identifier, recentRequests);

    return true;
}

/**
 * Create a rate-limited and validated IPC handler.
 */
export function registerRateLimitedHandler<TArgs, TReturn>(
    channel: string,
    argsValidator: ValidatorFn<TArgs>,
    handler: HandlerFn<TArgs, TReturn>,
    rateLimit: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }
): void {
    ipcMain.handle(channel, async (event, args) => {
        // Check rate limit
        const identifier = event.sender.id.toString();
        if (!checkRateLimit(channel, identifier, rateLimit)) {
            throw new Error('Too many requests. Please slow down.');
        }

        // Validate and handle
        return createValidatedHandler(argsValidator, handler)(event, args);
    });

    log.info(`[IPC] Registered rate-limited handler: ${channel}`);
}

export default {
    validators,
    commonValidators,
    createValidatedHandler,
    registerValidatedHandler,
    registerRateLimitedHandler,
    checkRateLimit,
};
