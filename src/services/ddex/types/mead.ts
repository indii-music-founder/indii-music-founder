import { DDEXMessageHeader, DPID, ResourceReference } from './common';

// Root Message
export interface MEADMessage {
    messageSchemaVersionId: string; // '1.0' usually, or newer
    messageHeader: DDEXMessageHeader;
    meadMessageContent: MEADContent;
}

export interface MEADContent {
    releases: MEADRelease[];
}

export interface MEADRelease {
    releaseId: {
        icpn?: string;
        catalogNumber?: string;
    };
    releaseReference: string; // Internal reference 'R1'

    // Enriched Data
    detailsByTerritory: MEADDetailsByTerritory[];
    resourceList: MEADResource[];
}

export interface MEADDetailsByTerritory {
    territoryCode: string; // 'Worldwide' or ISO code
    displayArtistName?: string;

    // Rich Metadata
    artistBiographies?: Biography[];
    reviews?: Review[];
    promotionalDetails?: PromotionalDetails;
}

export interface MEADResource {
    resourceReference: string;
    resourceId: {
        isrc: string;
    };
    resourceType: 'SoundRecording' | 'Image' | 'Video';

    // Resource-level enrichment
    lyrics?: TextDetails[];
    textDetails?: TextDetails[]; // Liner notes, etc.
}

// Sub-types
export interface Biography {
    artistName: string;
    biographyText: string;
    biographyType?: 'Short' | 'Long' | 'Promotional';
    languageAndScriptCode?: string;
}

export interface Review {
    reviewText: string;
    reviewTitle?: string;
    reviewer?: string;
    publicationDate?: string;
}

export interface PromotionalDetails {
    marketingMessage?: string;
    headline?: string;
}

export interface TextDetails {
    textType: 'Lyrics' | 'LinerNotes' | 'Description';
    text: string;
    languageAndScriptCode?: string;
}
