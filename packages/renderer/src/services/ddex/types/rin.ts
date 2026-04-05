import { DDEXMessageHeader, ResourceReference } from './common';

// Root Message
export interface RINMessage {
    messageSchemaVersionId: string; // '1.1' or newer
    messageHeader: DDEXMessageHeader;
    rinMessageContent: RINContent;
}

export interface RINContent {
    soundRecordings: RINSoundRecording[];
}

export interface RINSoundRecording {
    resourceReference: string;
    resourceId: {
        isrc: string;
    };
    title: string;

    // Detailed Studio Data
    contributors: RINContributor[];
    musicalInstruments?: MusicalInstrument[];
    studioSessions?: StudioSession[];
}

export interface RINContributor {
    partyName: string;
    partyId?: string;
    roles: string[]; // 'Instrumentalist', 'Producer', 'Engineer'
    instrumentType?: string; // 'Guitar', 'Piano' if role is Instrumentalist
}

export interface MusicalInstrument {
    instrumentType: string;
    description?: string;
}

export interface StudioSession {
    sessionDate: string; // ISO Date
    startTime?: string;
    endTime?: string;
    studioLocation: {
        studioName: string;
        city?: string;
        countryCode?: string;
    };
    participants: {
        partyName: string;
        role: string;
    }[];
}
