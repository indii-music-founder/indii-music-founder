export type FieldContactRole =
    | 'musician'
    | 'promoter'
    | 'venue_staff'
    | 'engineer'
    | 'manager'
    | 'fan'
    | 'industry'
    | 'media'
    | 'other';

export interface CaptureLocation {
    lat: number;
    lng: number;
    address?: string;
}

export interface FieldContact {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    instagram?: string;
    organization?: string;
    role: FieldContactRole;
    notes?: string;
    encounterId?: string;
    audioMemoUrl?: string;

    // Auto-populated metadata
    capturedAt: string | number | { seconds: number; nanoseconds: number };
    capturedLocation?: CaptureLocation;
    capturedContext?: string;
    photoUrl?: string;
    source: 'quick_capture' | 'manual' | 'import' | 'encounter_ai';
}

export type FieldContactInput = Omit<FieldContact, 'id'>;
