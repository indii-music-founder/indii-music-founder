
import { Timestamp } from 'firebase/firestore';

export enum TrackStatus {
    DEMO = 'demo',
    MIXING = 'mixing',
    MASTERING = 'mastering',
    RELEASE_READY = 'release_ready',
    RELEASED = 'released'
}

export interface Track {
    id: string;
    userId: string;
    title: string;
    artist: string;
    version: string;
    status: TrackStatus;
    filePath?: string;
    duration?: number;
    bpm?: number;
    key?: string;
    tags: string[];
    createdAt: Timestamp | number;
    updatedAt: Timestamp | number;
    metadata?: Record<string, any>;
}

export interface Playlist {
    id: string;
    userId: string;
    name: string;
    description?: string;
    tracks: string[]; // List of Track IDs
    createdAt: Timestamp | number;
    updatedAt: Timestamp | number;
}
