import { Timestamp } from 'firebase/firestore';

export type LicenseStatus = 'active' | 'expired' | 'pending' | 'revoked';
export type LicenseRequestStatus = 'checking' | 'pending_approval' | 'negotiating' | 'approved' | 'rejected' | 'completed';

export interface License {
    id?: string;
    title: string;
    artist: string;
    licenseType: string;
    status: LicenseStatus;
    agreementUrl?: string;
    startDate?: Timestamp;
    endDate?: Timestamp;
    usage: string;
    notes?: string;
    /**
     * Agreed license fee in whole USD, when the deal terms are known.
     * Optional and frequently absent — a license can be tracked before its fee is
     * settled. Consumers MUST treat "no license carries a fee" as unknown and show
     * an empty state, never a synthesized figure (ISSUE-1276: the licensing
     * dashboard previously displayed `licenses.length * 12500` as "Projected Value",
     * which was not derived from any real deal term).
     */
    feeUsd?: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
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
    requestedAt?: Timestamp;
    updatedAt?: Timestamp;
}
