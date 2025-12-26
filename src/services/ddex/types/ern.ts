/**
 * DDEX ERN (Electronic Release Notification) Types
 * Version: ERN 4.3 (supports AI-generated content flagging)
 */

import type {
  DDEXMessageHeader,
  DPID,
  TerritoryCode,
  ReleaseType,
  UseType,
  CommercialModelType,
  Price,
  DateRange,
  Contributor,
  TechnicalDetails,
  ParentalWarningType,
  AIGenerationInfo,
} from './common';

export type { Contributor };

// ERN Message - top level
export interface ERNMessage {
  messageSchemaVersionId: '4.3';
  messageHeader: DDEXMessageHeader;
  releaseList: Release[];
  resourceList: Resource[];
  dealList: Deal[];
}

// Release - the product being distributed
export interface Release {
  releaseId: ReleaseId;
  releaseReference: string;  // Internal reference (e.g., 'R0001')
  releaseType: ReleaseType;
  releaseTitle: TitleText;
  releaseSubTitle?: TitleText;
  displayArtistName: string;
  displayArtistPartyId?: string;
  contributors: Contributor[];
  labelName: string;
  pLine?: CopyrightLine;
  cLine?: CopyrightLine;
  releaseDate?: ReleaseDate;
  originalReleaseDate?: string;
  genre: GenreWithSubGenre;
  parentalWarningType: ParentalWarningType;
  marketingComment?: string;
  keyWords?: string[];

  // AI Generation (ERN 4.3)
  aiGenerationInfo?: AIGenerationInfo;

  // Resources in this release
  releaseResourceReferenceList: string[];  // References to resources

  // Additional metadata
  releaseDetailsByTerritory?: ReleaseDetailsByTerritory[];
}

// Release Identifiers
export interface ReleaseId {
  icpn?: string;   // International Standard Recording Code Product Number (barcode)
  gridId?: string; // Global Release Identifier
  isrc?: string;   // For single-track releases
  catalogNumber?: string;
  proprietaryId?: ProprietaryId;
}

export interface ProprietaryId {
  proprietaryIdType: string;
  id: string;
}

// Title with type
export interface TitleText {
  titleText: string;
  titleType?: 'FormalTitle' | 'DisplayTitle' | 'GroupingTitle' | 'AlternativeTitle';
  languageCode?: string;  // ISO 639-2
}

// Copyright Lines
export interface CopyrightLine {
  year: number;
  text: string;
}

// Release Date with territory-specific dates
export interface ReleaseDate {
  releaseDate: string;  // ISO 8601
  isOriginalReleaseDate?: boolean;
}

// Genre
export interface GenreWithSubGenre {
  genre: string;
  subGenre?: string;
}

// Territory-specific release details
export interface ReleaseDetailsByTerritory {
  territoryCode: TerritoryCode[];
  displayArtistName?: string;
  releaseTitle?: TitleText;
  labelName?: string;
  releaseDate?: string;
}

// Resource - the actual content (audio, video, image)
export interface Resource {
  resourceReference: string;  // Internal reference (e.g., 'A0001')
  resourceType: 'SoundRecording' | 'Video' | 'Image';
  resourceId: ResourceId;
  resourceTitle: TitleText;
  displayArtistName: string;
  contributors: Contributor[];
  duration?: string;  // ISO 8601 duration
  technicalDetails?: TechnicalDetails;
  parentalWarningType?: ParentalWarningType;

  // AI Generation (ERN 4.3)
  aiGenerationInfo?: AIGenerationInfo;

  // For sound recordings
  soundRecordingDetails?: SoundRecordingDetails;
}

export interface ResourceId {
  isrc?: string;  // International Standard Recording Code
  proprietaryId?: ProprietaryId;
}

export interface SoundRecordingDetails {
  soundRecordingType: 'MusicalWorkSoundRecording' | 'NonMusicalWorkSoundRecording';
  isInstrumental: boolean;
  languageOfPerformance?: string;  // ISO 639-2
  iswc?: string;  // International Standard Musical Work Code
}

// Deal - commercial terms for distribution
export interface Deal {
  dealReference: string;
  dealTerms: DealTerms;
}

export interface DealTerms {
  commercialModelType: CommercialModelType;
  usage: Usage[];
  territoryCode: TerritoryCode[];
  validityPeriod: DateRange;
  priceInformation?: PriceInformation;
  releaseDisplayStartDate?: string;
  preOrderReleaseDate?: string;
  takeDown?: boolean;
}

export interface Usage {
  useType: UseType;
  distributionChannelType?: 'Download' | 'Stream' | 'MobileDevice';
}

export interface PriceInformation {
  priceType: 'WholesalePricePerUnit' | 'SuggestedRetailPrice';
  price: Price;
}

// ERN Builder Helper Type
export interface ERNBuildOptions {
  sender: DPID;
  recipient: DPID;
  isTest?: boolean;
}

// ERN Validation specific errors
export type ERNValidationErrorCode =
  | 'MISSING_ISRC'
  | 'INVALID_TERRITORY'
  | 'MISSING_RELEASE_DATE'
  | 'INVALID_DEAL_PERIOD'
  | 'MISSING_CONTRIBUTOR'
  | 'INVALID_DURATION'
  | 'MISSING_GENRE'
  | 'INCOMPLETE_AI_DISCLOSURE';
