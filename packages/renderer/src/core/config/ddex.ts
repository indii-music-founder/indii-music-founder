/**
 * DDEX Configuration and Party Constants
 * Source: dpid.ddex.net
 */

export const DDEX_CONFIG = {
    // Assigned DPID for New Detroit Music LLC
    PARTY_ID: 'PA-DPIDA-2025122604-E',

    // Official Legal Name registered with DDEX
    PARTY_NAME: 'New Detroit Music LLC',

    // Doing Business As (DBA)
    TRADING_NAME: 'indiiOS LLC',

    // Default version for ERN messages
    ERN_VERSION: '4.3',

    // Contact Info (for reference/messaging)
    CONTACT: {
        NAME: 'William Roberts',
        EMAIL: 'the.walking.agency.det@gmail.com',
        ADDRESS: '3808 15th St, Detroit, MI 48208, USA',
        PHONE: '+1-313-746-8136'
    }
} as const;
