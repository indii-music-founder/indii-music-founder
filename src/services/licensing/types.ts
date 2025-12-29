export type LicenseStatus = 'active' | 'expired' | 'pending' | 'revoked';
export type LicenseRequestStatus = 'checking' | 'pending_approval' | 'negotiating' | 'approved' | 'rejected' | 'completed';

export interface License {
    id?: string;
    title: string;
    artist: string;
    licenseType: string;
    status: LicenseStatus;
    agreementUrl?: string;
    startDate?: any; // Firestore Timestamp
    endDate?: any; // Firestore Timestamp
    usage: string;
    notes?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface LicenseRequest {
    id?: string;
    title: string;
    artist: string;
    usage: string;
    status: LicenseRequestStatus;
    quote?: string;
    notes?: string;
    sourceUrl?: string;
    aiAnalysis?: string;
    requestedAt?: any;
    updatedAt?: any;
}
