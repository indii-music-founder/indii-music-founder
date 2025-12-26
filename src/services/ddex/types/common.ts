/**
 * DDEX Common Types
 * Shared types used across all DDEX message standards
 */

// DDEX Party Identifier - unique identifier for entities in DDEX ecosystem
export interface DPID {
  partyId: string;  // Format: PADPIDA{10-digit-code}
  partyName: string;
}

// ISO 3166-1 Territory Codes
export type TerritoryCode = 'Worldwide' | string;  // 'US', 'GB', 'DE', etc.

// Message Header - common to all DDEX messages
export interface DDEXMessageHeader {
  messageId: string;
  messageThreadId?: string;
  messageSender: DPID;
  messageRecipient: DPID;
  messageCreatedDateTime: string;  // ISO 8601
  messageControlType?: 'LiveMessage' | 'TestMessage';
}

// Resource Types
export type ResourceType = 'SoundRecording' | 'Video' | 'Image' | 'Text' | 'Software';

export interface ResourceReference {
  resourceId: string;
  resourceType: ResourceType;
}

// Release Types
export type ReleaseType =
  | 'Single'
  | 'EP'
  | 'Album'
  | 'Compilation'
  | 'Mixtape'
  | 'Audiobook'
  | 'ClassicalAlbum';

// Use Types for deals
export type UseType =
  | 'OnDemandStream'
  | 'PermanentDownload'
  | 'TimeDelimitedStream'
  | 'NonInteractiveStream'
  | 'Broadcast'
  | 'Simulcast';

// Commercial Model Types
export type CommercialModelType =
  | 'AdvertisementSupportedModel'
  | 'PayAsYouGoModel'
  | 'SubscriptionModel'
  | 'FreeOfChargeModel';

// Price Types
export interface Price {
  amount: number;
  currencyCode: string;  // ISO 4217 (USD, EUR, GBP)
}

// Date/Time Range
export interface DateRange {
  startDate: string;  // ISO 8601
  endDate?: string;   // ISO 8601, optional for ongoing
}

// Contributor Roles
export type ContributorRole =
  | 'MainArtist'
  | 'FeaturedArtist'
  | 'Composer'
  | 'Lyricist'
  | 'Producer'
  | 'Arranger'
  | 'Mixer'
  | 'MasteringEngineer'
  | 'RecordingEngineer'
  | 'RemixArtist'
  | 'AssociatedPerformer';

// Contributor
export interface Contributor {
  name: string;
  role: ContributorRole;
  sequenceNumber?: number;
  partyId?: string;  // ISNI or proprietary ID
}

// Technical Details for audio resources
export interface TechnicalDetails {
  audioCodec?: 'FLAC' | 'WAV' | 'MP3' | 'AAC';
  samplingRate?: number;  // Hz (44100, 48000, 96000)
  bitDepth?: number;      // 16, 24, 32
  numberOfChannels?: number;  // 1=mono, 2=stereo
  duration?: string;      // ISO 8601 duration (PT3M45S)
  fileSizeInBytes?: number;
}

// Parental Warning / Explicit content
export type ParentalWarningType = 'Explicit' | 'NotExplicit' | 'NoAdviceAvailable' | 'Edited';

// AI Generation flags (ERN 4.3)
export interface AIGenerationInfo {
  isFullyAIGenerated: boolean;
  isPartiallyAIGenerated: boolean;
  aiToolsUsed?: string[];
  humanContributionDescription?: string;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'warning';
}

// Delivery status
export type DeliveryStatus =
  | 'draft'
  | 'validating'
  | 'queued'
  | 'delivering'
  | 'delivered'
  | 'acknowledged'
  | 'published'
  | 'failed'
  | 'rejected';

// Acknowledgement types
export interface DeliveryAcknowledgement {
  messageId: string;
  originalMessageId: string;
  status: 'Accepted' | 'Rejected' | 'PartiallyAccepted';
  timestamp: string;
  errors?: ValidationError[];
}
