import { Timestamp } from 'firebase/firestore';

// ============================================================================
// FieldContact — Contacts captured on-the-road via QuickCapture
// ============================================================================

/**
 * Role taxonomy for field contacts.
 * Broader than the publicist Contact type which is media-focused.
 */
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

/**
 * Geolocation snapshot at time of capture.
 */
export interface CaptureLocation {
    lat: number;
    lng: number;
    address?: string;
}

/**
 * A contact captured in the field — at a show, on the road, backstage, etc.
 * 
 * Design principle: only `name` is required. Everything else is optional.
 * Auto-populated metadata (capturedAt, capturedLocation) fills gaps so
 * even a name-only entry has enough context to follow up later.
 */
export interface FieldContact {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    instagram?: string;
    role: FieldContactRole;
    notes?: string;

    // Auto-populated metadata
    capturedAt: Timestamp;
    capturedLocation?: CaptureLocation;
    capturedContext?: string; // e.g. "Detroit Techno Show @ The Loft"
    photoUrl?: string;       // Business card or person photo
    source: 'quick_capture' | 'manual' | 'import';
}

/**
 * Input shape for creating a new FieldContact (id and capturedAt are auto-generated).
 */
export type FieldContactInput = Omit<FieldContact, 'id' | 'capturedAt'> & {
    capturedAt?: Timestamp;
};
