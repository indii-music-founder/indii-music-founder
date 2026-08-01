import { IngestionMessageHeader } from './common';

// Root Message
export interface MediaAssetDataMessage {
    messageSchemaVersionId: string; // '1.0' usually, or newer
    messageHeader: IngestionMessageHeader;
    meadMessageContent: MediaAssetDataContent;
}

export interface MediaAssetDataContent {
    releases: MediaAssetDataRelease[];
}

export interface MediaAssetDataRelease {
    releaseId: {
        icpn?: string;
        catalogNumber?: string;
    };
    releaseReference: string; // Internal reference 'R1'

    // Enriched Data
    detailsByTerritory: MediaAssetDataDetailsByTerritory[];
    resourceList: MediaAssetDataResource[];
}

export interface MediaAssetDataDetailsByTerritory {
    territoryCode: string; // 'Worldwide' or ISO code
    displayArtistName?: string;

    // Rich Metadata
    artistBiographies?: Biography[];
    reviews?: Review[];
    promotionalDetails?: PromotionalDetails;
}

export interface MediaAssetDataResource {
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
