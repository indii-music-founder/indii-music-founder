import type { FieldContact } from './contacts';

export type EncounterStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export type EncounterAssetType = 'audio' | 'photo' | 'video' | 'document' | 'receipt';

export interface EncounterAsset {
    id: string;
    type: EncounterAssetType;
    storagePath: string;
    downloadUrl: string;
    mimeType: string;
    filename?: string;
    durationSeconds?: number;
    sizeBytes?: number;
    createdAt: string;
}

export interface EncounterGeoLocation {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    address?: string;
    venueName?: string;
}

export interface FieldEncounter {
    id: string;
    userId: string;
    status: EncounterStatus;
    title?: string;
    summary?: string;
    assets: EncounterAsset[];
    location?: EncounterGeoLocation;
    extractedContact?: Partial<FieldContact>;
    contactId?: string;
    noteId?: string;
    audioTranscript?: string;
    createdAt: string;
    updatedAt: string;
    error?: string;
}

export interface CreateEncounterInput {
    assets: Omit<EncounterAsset, 'id' | 'createdAt'>[];
    location?: EncounterGeoLocation;
    clientContext?: string;
}
