import { IngestionMessageHeader } from './common';

// Root Message
export interface RecordingInformationMessage {
    messageSchemaVersionId: string; // '1.1' or newer
    messageHeader: IngestionMessageHeader;
    rinMessageContent: RecordingInformationContent;
}

export interface RecordingInformationContent {
    soundRecordings: RecordingInformationSoundRecording[];
}

export interface RecordingInformationSoundRecording {
    resourceReference: string;
    resourceId: {
        isrc: string;
    };
    title: string;

    // Detailed Studio Data
    contributors: RecordingInformationContributor[];
    musicalInstruments?: MusicalInstrument[];
    studioSessions?: StudioSession[];
}

export interface RecordingInformationContributor {
    entityName: string;
    systemIdentifier?: string;
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
        entityName: string;
        role: string;
    }[];
}
