/**
 * rightsRegistration.ts
 *
 * Foundational schema and contract definitions for ISSUE-1511:
 * Assisted Rights Registration Engine — Screen Control & Browser Copilot
 * for Official Music Rights Infrastructure (US Copyright Office eCO, The MLC, PROs, SoundExchange, HFA).
 *
 * Bridges Artist Passport diagnostic findings directly into official royalty collection registration.
 */
export type PortalTarget = 'loc_copyright' | 'the_mlc' | 'bmi' | 'ascap' | 'soundexchange' | 'hfa';
export type CopyrightFormType = 'Form_PA' | 'Form_SR' | 'Form_GRUW' | 'Form_GRAM';
export interface ContributorSplit {
    legalName: string;
    stageName?: string;
    role: 'writer_composer' | 'lyricist' | 'producer' | 'featured_performer' | 'master_owner';
    sharePercentage: number;
    ipiCaeNumber?: string;
    proAffiliation?: 'ASCAP' | 'BMI' | 'SESAC' | 'SOCAN' | 'PRS' | 'Other' | 'None';
    email?: string;
}
export interface DepositAsset {
    filename: string;
    fileSizeBytes: number;
    mimeType: 'audio/wav' | 'audio/mpeg' | 'audio/flac' | 'application/pdf';
    sha256Checksum: string;
    durationSeconds?: number;
    localPath?: string;
}
export interface WorkMetadata {
    title: string;
    alternateTitles?: string[];
    yearOfCreation: number;
    isPublished: boolean;
    dateOfFirstPublication?: string;
    nationOfFirstPublication?: string;
    isrc?: string;
    iswc?: string;
    lyricsText?: string;
}
export interface RightsRegistrationManifest {
    manifestId: string;
    artistId: string;
    artistLegalName: string;
    artistStageName?: string;
    citizenshipOrDomicile: string;
    targetPortals: PortalTarget[];
    copyrightFormType?: CopyrightFormType;
    work: WorkMetadata;
    splits: ContributorSplit[];
    depositAssets: DepositAsset[];
    createdAtMs: number;
    updatedAtMs: number;
}
export type CopilotActionType = 'navigate' | 'highlight_element' | 'autofill_input' | 'select_option' | 'stage_deposit_upload' | 'pause_for_user_auth' | 'pause_for_user_payment' | 'verify_dom_field' | 'extract_confirmation';
export interface CopilotAction {
    id: string;
    type: CopilotActionType;
    description: string;
    targetSelector?: string;
    targetFieldKey?: string;
    value?: string | number | boolean;
    requiresUserAction: boolean;
    timeoutMs?: number;
}
export type BrowserCopilotSessionStatus = 'idle' | 'navigating' | 'awaiting_user_auth' | 'filling_fields' | 'deposit_uploading' | 'awaiting_user_payment' | 'verifying' | 'completed' | 'failed';
export interface BrowserCopilotSession {
    sessionId: string;
    manifestId: string;
    portalTarget: PortalTarget;
    status: BrowserCopilotSessionStatus;
    currentActionIndex: number;
    actions: CopilotAction[];
    lastError?: string;
    startedAtMs: number;
    completedAtMs?: number;
    confirmationNumber?: string;
    serviceRequestId?: string;
}
export interface RegistrationFilingRecord {
    id: string;
    artistId: string;
    portalTarget: PortalTarget;
    workTitle: string;
    isrc?: string;
    iswc?: string;
    status: 'draft' | 'in_progress' | 'submitted' | 'confirmed' | 'rejected';
    confirmationNumber?: string;
    serviceRequestId?: string;
    officialFilingDate?: string;
    depositChecksum?: string;
    filingFeeUsd?: number;
    createdAtMs: number;
    updatedAtMs: number;
}
/**
 * Validates the core integrity of a RightsRegistrationManifest.
 * Ensures legal name, target portals, and splits balance out to 100%.
 */
export declare function validateRegistrationManifest(manifest: Partial<RightsRegistrationManifest>): {
    isValid: boolean;
    errors: string[];
};
/**
 * Validates a deposit asset prior to Library of Congress upload.
 */
export declare function validateDepositAsset(asset: DepositAsset): {
    isValid: boolean;
    errors: string[];
};
/**
 * Builds a default structured Copilot Action sequence for a given portal target.
 */
export declare function generateCopilotActionPlan(manifest: RightsRegistrationManifest, target: PortalTarget): CopilotAction[];
/**
 * Constructs an immutable Provenance & Audit Trail filing record once an official submission
 * confirmation number or Service Request (SR) ID is captured from the portal.
 */
export declare function createRegistrationFilingRecord(manifest: RightsRegistrationManifest, portalTarget: PortalTarget, confirmation: {
    confirmationNumber: string;
    serviceRequestId?: string;
    filingFeeUsd?: number;
    officialFilingDate?: string;
}): RegistrationFilingRecord;
//# sourceMappingURL=rightsRegistration.d.ts.map