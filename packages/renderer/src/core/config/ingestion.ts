/**
 * Proprietary Ingestion IP Configuration and System Constants
 * Source: runtime environment / deployment secrets.
 */

const requiredEnv = (key: string): string => {
    const value = (import.meta.env as Record<string, string | undefined>)[key]?.trim();
    if (!value) {
        if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
            return `TEST_${key}`;
        }
        throw new Error(`[IngestionConfig] Missing required environment variable ${key}`);
    }
    return value;
};

export const INGESTION_CONFIG = {
    // Assigned Proprietary System Identifier for the active content provider.
    get SYSTEM_IDENTIFIER() {
        return requiredEnv('VITE_INGESTION_SYSTEM_IDENTIFIER');
    },

    // Official legal name registered for the active content provider.
    get ENTITY_NAME() {
        return requiredEnv('VITE_INGESTION_ENTITY_NAME');
    },

    // Public trading name / DBA.
    get TRADING_NAME() {
        return requiredEnv('VITE_INGESTION_TRADING_NAME');
    },

    // Default version for proprietary ingestion messages
    INGESTION_VERSION: '4.3',

    // Contact info used in generated partner-facing metadata.
    CONTACT: {
        get NAME() {
            return requiredEnv('VITE_INGESTION_CONTACT_NAME');
        },
        get EMAIL() {
            return requiredEnv('VITE_INGESTION_CONTACT_EMAIL');
        },
        get ADDRESS() {
            return requiredEnv('VITE_INGESTION_CONTACT_ADDRESS');
        },
        get PHONE() {
            return requiredEnv('VITE_INGESTION_CONTACT_PHONE');
        }
    }
} as const;
