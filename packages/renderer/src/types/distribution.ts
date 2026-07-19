export interface MerlinTrack {
    isrc: string;
    title?: string;
    rights_holder?: string;
    exclusive_rights?: boolean;
    [key: string]: unknown;
}

import type { AudioSemanticData } from '@/services/audio/types';

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
    isrc?: string;
    artist?: string;
    // ISSUE-792 FIX: Real writer data (never defaults like "John Doe")
    writer_first: string;
    writer_last: string;
    writer_ipi?: string;
    writer_role?: string; // C (Composer), A (Author), CA (Both)
    // Publisher data (never "Self-Published" default)
    publisher: string;
    publisher_ipi?: string;
    // Royalty split share (from actual metadata, not hardcoded 100%)
    collection_share: number;
    // Release date from metadata (not today's date)
    release_date: string;
    // Metadata helpers
    id?: string;
    iswc?: string;
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

/**
 * ISSUE-793: field names must match tax_withholding_engine.py's
 * certify_user() exactly — this is the canonical shape for the
 * distribution:certify-tax IPC call. Raw TIN is never persisted; the engine
 * validates it in-memory and stores only tin_masked/tin_valid.
 */
export interface TaxCertificationData {
    full_name: string;
    country: string;
    tin: string;
    is_us_person: boolean;
    is_entity: boolean;
    signed_under_perjury: boolean;
}

export interface TaxReport {
    form_type: string;
    country: string;
    tin_masked: string;
    tin_valid: boolean;
    certified: boolean;
    payout_status: 'ACTIVE' | 'HELD';
    cert_timestamp: string;
    /** A percent value, e.g. 30.0 means 30% — NOT a 0-1 fraction. Divide by 100 to use in amount math. */
    withholding_rate: number;
}

/**
 * CONTRACT LOCK (ISSUE-826): field names below MUST match what
 * execution/finance/waterfall_payout.py reads verbatim — the IPC handler
 * passes this payload through untranslated. The engine requires 'gross'
 * (it exits 1 on 'gross_revenue') and reads 'recoupment', never 'expenses'.
 */
export interface WaterfallData {
    gross: number;
    splits: Record<string, number>; // party -> fraction 0.0 to 1.0
    /** Outstanding recoupable balance, applied after the platform fee. */
    recoupment?: number;
    /** Platform fee as a 0-1 fraction (0.15 = 15%). Python default: 0.15. */
    indii_fee_percent?: number;
}

export interface WaterfallDistributionEntry {
    /** Display string from the engine, e.g. "50.0%". */
    split: string;
    /** Payout amount in dollars. */
    amount: number;
}

/**
 * CONTRACT LOCK (ISSUE-826): mirrors the report dict printed by
 * execution/finance/waterfall_payout.py exactly. Distributions are NESTED
 * objects (split + amount), not flat numbers. "Net" for display purposes is
 * total_distributed (post-fee, post-recoupment) — revenue_after_fee ignores
 * recoupment.
 */
export interface WaterfallReport {
    gross: number;
    platform_fee: { percent: string; amount: number };
    revenue_after_fee: number;
    recoupment: { starting_balance: number; applied: number; remaining_balance: number };
    distributions: Record<string, WaterfallDistributionEntry>;
    summary_status: 'PROCESSED';
    total_distributed: number;
    unallocated_balance: number;
    processed_at: string; // ISO-8601 UTC (added to the engine in ISSUE-826)
}

export interface ContentIdData {
    tracks: Array<{
        isrc: string;
        title: string;
        asset_id?: string;
        custom_id?: string;
    }>;
    upc: string;
    artist: string;
    album_title?: string;
    /**
     * Required rights confirmation (ISSUE-786). A false copyright claim can
     * suspend YouTube partner access — there is no default label, match
     * policy, or territory. Every field must be an explicit, real value.
     */
    rights_attestation: {
        exclusive_rights: true;
        label: string;
        match_policy: 'monetize' | 'track' | 'block';
        territories: string[];
    };
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

export interface IngestionTrack {
    isrc?: string;
    title: string;
    version?: string; // e.g. "Remix", "Radio Edit"
    artist?: string;
    artists?: string[];
    duration?: number; // In seconds
    explicit?: boolean;
    filename?: string;
    file_hash?: string; // MD5 hash used by the DDEX resource descriptor
    /** Immutable upload-once master verified and staged by the desktop delivery boundary. */
    master_asset?: {
        content_hash: string;
        download_url: string;
        master_fingerprint: string;
        mime_type: string;
        original_file_name: string;
        size_bytes: number;
        storage_path: string;
    };
    genre?: string;
    sub_genre?: string;
    language?: string;
    marketing_comment?: string;
    audio_dna?: AudioSemanticData;
    label?: string;
    p_line?: string; // Phonographic Copyright
    c_line?: string; // Copyright
    track_number?: number;
    volume_number?: number;
    is_compilation?: boolean;
    sample_rate?: number;
    bit_depth?: number;
    channels?: number;
    codec?: string;
    [key: string]: unknown;
}

export interface IngestionMetadata {
    releaseId: string;
    title: string;
    version?: string;
    artist?: string;
    artists?: string[];
    tracks: IngestionTrack[];
    label?: string;
    upc?: string;
    isrc?: string; // Release level identifier
    genre?: string;
    release_date?: string; // YYYY-MM-DD
    releaseDate?: string; // Legacy/UI alias 
    artwork_url?: string;
    artworkUrl?: string; // UI alias
    cover_filename?: string;
    cover_hash?: string;
    p_line?: string;
    c_line?: string;
    is_compilation?: boolean;
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

export interface IngestionResponse extends IPCResponse<unknown> {
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
