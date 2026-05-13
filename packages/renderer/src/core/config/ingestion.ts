/**
 * Proprietary Ingestion IP Configuration and System Constants
 * Source: Proprietary System Registry
 */

export const INGESTION_CONFIG = {
    // Assigned Proprietary System Identifier for New Detroit Music LLC
    SYSTEM_IDENTIFIER: 'PA-DPIDA-2025122604-E',

    // Official Legal Name registered with regulatory authorities
    ENTITY_NAME: 'New Detroit Music LLC',

    // Doing Business As (DBA)
    TRADING_NAME: 'indii.music',

    // Default version for proprietary ingestion messages
    INGESTION_VERSION: '4.3',

    // Contact Info (for reference/messaging)
    CONTACT: {
        NAME: 'William Roberts',
        EMAIL: 'the.walking.agency.det@gmail.com',
        ADDRESS: '3808 15th St, Detroit, MI 48208, USA',
        PHONE: '+1-313-746-8136'
    }
} as const;
