/**
 * Distributor Configuration
 * Definitions for supported music distributors and their DDEX requirements.
 */

export interface DistributorProfile {
    id: string;
    name: string;
    ddexPartyId: string; // The recipient Party ID for ERNs
    ftpHost?: string; // Optional SFTP/FTP host for delivery
    ftpUser?: string; // Optional SFTP/FTP username (usually distinct per user, but some use shared)
    requiresUPC: boolean; // Does this distributor require a UPC upfront?
    requiresISRC: boolean;
}

export const DISTRIBUTORS: Record<string, DistributorProfile> = {
    distrokid: {
        id: 'distrokid',
        name: 'DistroKid',
        ddexPartyId: 'PADPIDA2013021901W', // Verified DistroKid Party ID
        requiresUPC: false, // DistroKid generates if missing
        requiresISRC: false, // DistroKid generates if missing
    },
    tunecore: {
        id: 'tunecore',
        name: 'TuneCore',
        ddexPartyId: 'PADPIDA2009090203U', // Verified TuneCore Party ID
        requiresUPC: true, // Often requires UPC
        requiresISRC: true,
    },
    cdbaby: {
        id: 'cdbaby',
        name: 'CD Baby',
        ddexPartyId: 'PADPIDA20061109026', // Verified CD Baby Party ID
        requiresUPC: false,
        requiresISRC: false,
    },
    symphonic: {
        id: 'symphonic',
        name: 'Symphonic Distribution',
        ddexPartyId: 'PADPIDA2011030901S', // Verified Symphonic Party ID
        requiresUPC: true,
        requiresISRC: true,
    },
    generic: {
        id: 'generic',
        name: 'Generic Distributor',
        ddexPartyId: 'PADPIDA0000000000', // Placeholder
        requiresUPC: true,
        requiresISRC: true,
    }
};

export type DistributorParams = keyof typeof DISTRIBUTORS;
