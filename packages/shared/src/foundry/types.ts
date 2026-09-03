/**
 * indii Format Intelligence & Capability Foundry
 * Core Shared Types and Contracts
 */

// ============================================================================
// 1. Evidence Intake
// ============================================================================

export type EvidenceItemKind =
  | 'input_sample'
  | 'reference_output'
  | 'specification'
  | 'schema'
  | 'fixture_good'
  | 'fixture_bad'
  | 'log_sample'
  | 'user_note';

export type SensitivityClassification =
  | 'public'
  | 'confidential_artist'
  | 'sensitive_financial'
  | 'restricted_pii';

export interface EvidenceConstraint {
  classification: SensitivityClassification;
  mayRetain: boolean;
  mayUseForGeneratedTests: boolean;
  allowExternalModelReasoning: boolean;
  legalNotice?: string;
  sourceAttribution?: string;
}

export interface EvidenceItem {
  id: string;
  kind: EvidenceItemKind;
  filename: string;
  sizeBytes: number;
  sha256: string;
  mimeType: string;
  claimedFormat?: string;
  detectedFormat?: string;
  version?: string;
  acquiredAt: string;
  constraints: EvidenceConstraint;
  rawSampleSnippet?: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceSet {
  id: string;
  name: string;
  targetFormatDomain: string; // e.g. 'distributor_sales_statement', 'ddex_ern', 'cue_sheet'
  items: EvidenceItem[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 2. Format Forensics
// ============================================================================

export type ContainerType =
  | 'flat_delimited'
  | 'structured_xml'
  | 'structured_json'
  | 'binary_container'
  | 'archive_package'
  | 'unknown';

export type DelimiterType = 'comma' | 'tab' | 'semicolon' | 'pipe' | 'whitespace' | 'fixed_width';

export type InferredFieldSemantic =
  | 'isrc'
  | 'upc'
  | 'iswc'
  | 'currency_amount'
  | 'quantity_count'
  | 'stream_count'
  | 'download_count'
  | 'iso_date'
  | 'us_date'
  | 'territory_code'
  | 'track_title'
  | 'artist_name'
  | 'album_title'
  | 'dsp_name'
  | 'transaction_type'
  | 'fee_amount'
  | 'generic_text'
  | 'generic_number';

export interface ColumnForensics {
  index: number;
  rawHeader: string;
  normalizedHeader: string;
  inferredSemantic: InferredFieldSemantic;
  confidence: number; // 0.0 to 1.0
  sampleValues: string[];
  emptyCount: number;
  uniqueCount: number;
  isNullable: boolean;
}

export interface FormatForensicsReport {
  evidenceItemId: string;
  container: ContainerType;
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'ascii' | 'unknown';
  hasBom: boolean;
  lineEnding: 'lf' | 'crlf' | 'cr';
  delimiter?: DelimiterType;
  headerRowIndex?: number;
  dataStartRowIndex?: number;
  totalRowsObserved: number;
  columnCount: number;
  columns: ColumnForensics[];
  magicBytesHex?: string;
  identifiedSignatures: string[];
  detectedFormatFamily: string;
  detectedVersion?: string;
  forensicsConfidence: number;
  timestamp: string;
}

// ============================================================================
// 3. Controlled Experiment Runner
// ============================================================================

export type MutationType =
  | 'change_delimiter'
  | 'alter_column_casing'
  | 'remove_optional_column'
  | 'reorder_columns'
  | 'inject_empty_rows'
  | 'mutate_date_format'
  | 'mutate_currency_symbol'
  | 'corrupt_single_value';

export interface ExperimentMutation {
  type: MutationType;
  target: string;
  originalValue?: string;
  mutatedValue?: string;
  description: string;
}

export interface ExperimentDefinition {
  id: string;
  name: string;
  baselineEvidenceId: string;
  mutations: ExperimentMutation[];
  expectedInvariant: string;
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  success: boolean;
  executionDurationMs: number;
  exitCode: number;
  rowsProcessed: number;
  rowsMatched: number;
  invariantPreserved: boolean;
  differenceSummary: string[];
  observedErrors: string[];
  executedAt: string;
}

// ============================================================================
// 4. Hypothesis Ledger
// ============================================================================

export type HypothesisCategory =
  | 'container_structure'
  | 'delimiter_and_encoding'
  | 'header_mapping'
  | 'semantic_type'
  | 'revenue_math'
  | 'fee_deduction'
  | 'split_allocation'
  | 'date_and_territory'
  | 'version_marker';

export interface FormatHypothesis {
  id: string;
  category: HypothesisCategory;
  ruleStatement: string;
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  confidence: number; // 0.0 to 1.0
  status: 'proven' | 'tentative' | 'disproven' | 'unknown';
  applicableVersions: string[];
  knownExceptions: string[];
  verifiedAt?: string;
  dependentAdapterSymbols: string[];
}

export interface HypothesisLedgerState {
  formatId: string;
  formatName: string;
  version: string;
  hypotheses: FormatHypothesis[];
  aggregateConfidence: number;
  provenRulesCount: number;
  unknownRulesCount: number;
  lastUpdated: string;
}

// ============================================================================
// 5. Deterministic Adapters & Normalization
// ============================================================================

export interface ParseOptions {
  strict?: boolean;
  currencyDefault?: string;
  territoryDefault?: string;
  maxRowsToSample?: number;
  skipQuarantine?: boolean;
}

export interface RawRowRecord {
  lineIndex: number;
  fields: Record<string, string>;
  rawLine: string;
}

export interface NormalizedStatementTransaction {
  sourceLineIndex: number;
  sourceHash: string;
  transactionId: string;
  isrc?: string;
  upc?: string;
  trackTitle: string;
  artistName: string;
  albumTitle?: string;
  dspName: string;
  transactionType: 'stream' | 'download' | 'subscription' | 'ad_supported' | 'cloud' | 'other';
  quantity: number;
  grossRevenue: number;
  distributorFee: number;
  netRevenue: number;
  currency: string;
  territory: string;
  salePeriodStart?: string;
  salePeriodEnd?: string;
  rawSourceFields: Record<string, string>;
}

export interface NormalizedStatementReport {
  formatId: string;
  adapterVersion: string;
  reportId: string;
  reportingEntity: string;
  currency: string;
  totalGrossRevenue: number;
  totalDistributorFees: number;
  totalNetRevenue: number;
  totalQuantity: number;
  totalStreams: number;
  totalDownloads: number;
  periodStart?: string;
  periodEnd?: string;
  transactions: NormalizedStatementTransaction[];
  quarantinedRows: QuarantinedRow[];
  provenance: {
    evidenceSha256: string;
    parsedAt: string;
    deterministicHash: string;
  };
}

export interface QuarantinedRow {
  lineIndex: number;
  rawContent: string;
  reason: string;
  errorCode: string;
  severity: 'warning' | 'fatal_row';
}

// ============================================================================
// 6. Layered Validation
// ============================================================================

export interface ByteValidationResult {
  layer: 'byte';
  passed: boolean;
  totalBytes: number;
  sha256Match: boolean;
  observedSha256: string;
  expectedSha256?: string;
  details: string;
}

export interface StructuralValidationResult {
  layer: 'structural';
  passed: boolean;
  totalLines: number;
  inconsistentColumnCountRows: number[];
  unbalancedQuotesRows: number[];
  details: string;
}

export interface SchemaValidationResult {
  layer: 'schema';
  passed: boolean;
  schemaId: string;
  validationErrors: Array<{ path: string; message: string; code: string }>;
}

export interface SemanticValidationResult {
  layer: 'semantic';
  passed: boolean;
  mathBalanced: boolean;
  grossSum: number;
  netSum: number;
  feeSum: number;
  mathDelta: number; // |gross - (net + fee)|
  isrcsValidRatio: number;
  upcsValidRatio: number;
  dateRangeChronological: boolean;
  splitsTotalValid: boolean;
  details: string;
}

export interface RoundTripValidationResult {
  layer: 'round_trip';
  passed: boolean;
  recordCountMatch: boolean;
  revenueParity: boolean;
  fieldParityRatio: number;
  details: string;
}

export interface DifferentialValidationResult {
  layer: 'differential';
  passed: boolean;
  comparedToBaselineId: string;
  variancePercentage: number;
  differingKeys: string[];
  details: string;
}

export interface HumanReviewValidationReceipt {
  layer: 'human_review';
  passed: boolean;
  requiresArtistConfirmation: boolean;
  warnings: string[];
  notableAnomalies: string[];
  summaryMessage: string;
}

export interface LayeredValidationReport {
  formatId: string;
  allPassed: boolean;
  byte: ByteValidationResult;
  structural: StructuralValidationResult;
  schema: SchemaValidationResult;
  semantic: SemanticValidationResult;
  roundTrip: RoundTripValidationResult;
  differential: DifferentialValidationResult;
  humanReview: HumanReviewValidationReceipt;
  timestamp: string;
}

// ============================================================================
// 7. Artist Business Graph Normalization
// ============================================================================

export interface GraphNormalizedRelease {
  upc: string;
  title: string;
  artist: string;
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalStreams: number;
  tracks: GraphNormalizedTrack[];
}

export interface GraphNormalizedTrack {
  isrc: string;
  title: string;
  artist: string;
  grossRevenue: number;
  netRevenue: number;
  streams: number;
  downloads: number;
  contributorAllocations: GraphContributorAllocation[];
  sourceLineIndices: number[];
}

export interface GraphContributorAllocation {
  contributorName: string;
  role: 'songwriter' | 'producer' | 'performer' | 'label' | 'other';
  sharePercentage: number;
  allocatedAmount: number;
  currency: string;
}

export interface ArtistBusinessGraphResolution {
  releases: GraphNormalizedRelease[];
  unmatchedIsrcs: string[];
  unmatchedUpcs: string[];
  totalAllocatedRevenue: number;
  contributorSummary: Record<string, { totalPayout: number; currency: string }>;
  lineageLinksCount: number;
}

// ============================================================================
// 8. Compatibility Drift & Quarantine
// ============================================================================

export interface CompatibilityDriftReport {
  formatId: string;
  baselineForensicsDate: string;
  isDriftDetected: boolean;
  hasNewColumns: boolean;
  newColumns: string[];
  hasMissingColumns: boolean;
  missingColumns: string[];
  columnOrderShifted: boolean;
  hasSyntaxMutation: boolean;
  severity: 'none' | 'benign' | 'breaking';
  quarantineRequired: boolean;
  suggestedPatchNotes?: string;
  detectedAt: string;
}

// ============================================================================
// 9. Registered Format Capability
// ============================================================================

export interface RegisteredFormatCapability {
  capabilityId: string;
  formatName: string;
  formatDomain: string;
  supportedVersions: string[];
  supportedExtensions: string[];
  operations: Array<'inspect' | 'parse' | 'normalize' | 'validate' | 'export'>;
  confidenceScore: number;
  isProductionReady: boolean;
  requiresConsequentialApproval: boolean;
  lastVerifiedDate: string;
  adapterClassName: string;
  provenanceEvidenceHash: string;
}
