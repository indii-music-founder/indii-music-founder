export interface MerlinTrack {
    isrc: string;
    title?: string;
    rights_holder?: string;
    exclusive_rights?: boolean;
    [key: string]: unknown;
}

export interface MerlinCheckData {
    catalog_id?: string;
    tracks: MerlinTrack[];
}

export interface MerlinReport {
    status: 'READY' | 'NOT_READY' | 'WARNING';
    issues: string[];
    passed_count: number;
    failed_count: number;
    timestamp: string;
}

export interface BWarmWork {
    title: string;
    writers: string[];
    isrc?: string;
    [key: string]: unknown;
}

export interface BWarmData {
    works: BWarmWork[];
    period_start?: string;
    period_end?: string;
}

export interface TaxCalculationData {
    userId: string;
    amount: number;
}

export interface TaxCertificationData {
    fullName: string;
    country: string;
    taxId: string; // TIN
    usPerson: boolean;
    signature: string;
}

export interface TaxReport {
    form_type: string;
    country: string;
    tin_masked: string;
    tin_valid: boolean;
    certified: boolean;
    payout_status: 'ACTIVE' | 'BLOCKED' | 'HOLD';
    cert_timestamp: string;
    withholding_rate: number;
}

export interface WaterfallData {
    gross_revenue: number;
    splits: Record<string, number>; // userId -> percentage (0.0 to 1.0)
    expenses?: number;
}

export interface WaterfallReport {
    distributions: Record<string, number>; // userId -> amount
    net_revenue: number;
    processed_at: string;
}

export interface ContentIdData {
    tracks: Array<{
        isrc: string;
        title: string;
        asset_id?: string;
        custom_id?: string;
    }>;
}

export interface ContentIdReport {
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    generated_count: number;
    errors?: string[];
}

export interface ISRCGenerationOptions {
    releaseId?: string;
    trackTitle?: string;
    artistName?: string;
    year?: string;
}

export interface UPCGenerationOptions {
    releaseId?: string;
    productTitle?: string;
    type?: 'ALBUM' | 'SINGLE' | 'EP';
}

export interface DDEXTrack {
    isrc: string;
    title: string;
    artist?: string;
    artists?: string[];
    duration?: number; // In seconds
    explicit?: boolean;
    filename?: string;
    file_hash?: string; // MD5 hash
    genre?: string;
    label?: string;
    sample_rate?: number;
    bit_depth?: number;
    channels?: number;
    codec?: string;
    [key: string]: unknown;
}

export interface DDEXMetadata {
    releaseId: string;
    title: string;
    artist?: string;
    artists?: string[];
    tracks: DDEXTrack[];
    label?: string;
    upc?: string;
    genre?: string;
    release_date?: string; // YYYY-MM-DD
}

/** Typed details from Python audio_fidelity_auditor.py / scan_audio_dna.py */
export interface ForensicsDetails {
    /** Integrated loudness in LUFS (e.g. "-14 LUFS") */
    estimated_lufs?: string;
    /** True peak level in dBTP (e.g. "-1.0") */
    true_peak_db?: string;
    /** Mix balance score 1-10 */
    mix_balance_score?: number;
    /** Low-mid frequency analysis narrative */
    low_mids_analysis?: string;
    /** High frequency analysis narrative */
    highs_analysis?: string;
    /** Mastering/mixing recommendations */
    recommendations?: string[];
    /** Audio file format (wav, flac, aiff, mp3, etc.) */
    format?: string;
    /** Sample rate in Hz (e.g. 44100, 48000) */
    sample_rate?: number;
    /** Bit depth (16, 24, 32) */
    bit_depth?: number;
    /** Channel count (1 = mono, 2 = stereo) */
    channels?: number;
}

export interface ForensicsReport {
    status: 'PASS' | 'FAIL' | 'WARNING';
    score: number;
    issues?: string[];
    details?: ForensicsDetails;
}

export interface ValidationReport {
    valid: boolean;
    errors: string[];
    warnings?: string[];
    summary?: string;
}

export interface IPCResponse<T> {
    success: boolean;
    error?: string;
    report?: T;
    // Some legacy handlers might return these specifics, mapped to T broadly
    // We normalize this in the service layer, but IPC needs strict shape
}

// Specific IPC Responses
export interface ISRCResponse extends IPCResponse<unknown> {
    isrc?: string;
}

export interface UPCResponse extends IPCResponse<unknown> {
    upc?: string;
}

export interface DDEXResponse extends IPCResponse<unknown> {
    xml?: string;
}

export interface CSVResponse<T> extends IPCResponse<T> {
    csv?: string;     // For BWARM
    csvData?: string; // For Content ID (legacy naming)
}

export interface PackageResponse extends IPCResponse<unknown> {
    itmspPath?: string;
    packagePath?: string;
    files?: string[];
    message?: string;
}

export interface SFTPConfig {
    protocol?: 'SFTP' | 'ASPERA';
    host: string;
    port?: number;
    user?: string;
    username?: string;
    password?: string;
    key?: string; // Path to private key
    privateKey?: string;
    localPath: string;
    remotePath?: string;
}

export interface SFTPReport {
    status: 'SUCCESS' | 'FAIL';
    message: string;
    host: string;
    remote_path: string;
    error?: string;
}

