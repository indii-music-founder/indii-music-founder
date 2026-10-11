/**
 * rightsRegistration.ts
 *
 * Foundational schema and contract definitions for ISSUE-1511:
 * Assisted Rights Registration Engine — Screen Control & Browser Copilot
 * for Official Music Rights Infrastructure (US Copyright Office eCO, The MLC, PROs, SoundExchange, HFA).
 *
 * Bridges Artist Passport diagnostic findings directly into official royalty collection registration.
 */

export type PortalTarget =
  | 'loc_copyright'   // US Copyright Office / Library of Congress eCO Portal
  | 'the_mlc'          // The Mechanical Licensing Collective (Digital Audio Mechanicals)
  | 'bmi'              // Broadcast Music, Inc. (Public Performance)
  | 'ascap'            // American Society of Composers, Authors and Publishers
  | 'soundexchange'    // SoundExchange (Digital Performance for Masters & Featured Artists)
  | 'hfa';             // Harry Fox Agency / Songfile (Mechanical Licensing)

export type CopyrightFormType =
  | 'Form_PA'   // Performing Arts (Musical Work / Composition / Lyrics)
  | 'Form_SR'   // Sound Recording (Master Recording)
  | 'Form_GRUW' // Group Registration of Unpublished Works (up to 10 works)
  | 'Form_GRAM';// Group Registration of Works on an Album of Music (up to 20 sound recordings)

export interface ContributorSplit {
  legalName: string;
  stageName?: string;
  role: 'writer_composer' | 'lyricist' | 'producer' | 'featured_performer' | 'master_owner';
  sharePercentage: number; // 0 to 100
  ipiCaeNumber?: string;   // 9 to 11 digit CISAC identifier
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
  dateOfFirstPublication?: string; // YYYY-MM-DD
  nationOfFirstPublication?: string; // e.g. 'United States'
  isrc?: string; // International Standard Recording Code
  iswc?: string; // International Standard Musical Work Code
  lyricsText?: string;
}

export interface RightsRegistrationManifest {
  manifestId: string;
  artistId: string;
  artistLegalName: string;
  artistStageName?: string;
  citizenshipOrDomicile: string; // e.g. 'United States'
  targetPortals: PortalTarget[];
  copyrightFormType?: CopyrightFormType;
  work: WorkMetadata;
  splits: ContributorSplit[];
  depositAssets: DepositAsset[];
  createdAtMs: number;
  updatedAtMs: number;
}

export type CopilotActionType =
  | 'navigate'               // Navigate to portal URL
  | 'highlight_element'      // Visually focus an input for user awareness
  | 'autofill_input'         // Populate form field with verified manifest data
  | 'select_option'          // Select dropdown value
  | 'stage_deposit_upload'   // Prepare deposit audio file for portal file dialog
  | 'pause_for_user_auth'    // Pause for user login / 2FA / CAPTCHA
  | 'pause_for_user_payment' // Pause for official government or society application fee
  | 'verify_dom_field'       // Assert DOM field matches expected value before next step
  | 'extract_confirmation';  // Scrape and verify submission confirmation number

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

export type BrowserCopilotSessionStatus =
  | 'idle'
  | 'navigating'
  | 'awaiting_user_auth'
  | 'filling_fields'
  | 'deposit_uploading'
  | 'awaiting_user_payment'
  | 'verifying'
  | 'completed'
  | 'failed';

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
export function validateRegistrationManifest(manifest: Partial<RightsRegistrationManifest>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!manifest.artistLegalName || manifest.artistLegalName.trim().length === 0) {
    errors.push('Artist legal name is required for official copyright and royalty filings');
  }

  if (!manifest.targetPortals || manifest.targetPortals.length === 0) {
    errors.push('At least one target portal (e.g. loc_copyright, the_mlc) must be specified');
  }

  if (!manifest.work || !manifest.work.title || manifest.work.title.trim().length === 0) {
    errors.push('Work title is required');
  }

  if (manifest.work && (manifest.work.yearOfCreation < 1900 || manifest.work.yearOfCreation > new Date().getFullYear() + 1)) {
    errors.push('Year of creation must be a valid four-digit year');
  }

  if (manifest.splits && manifest.splits.length > 0) {
    const writerSplits = manifest.splits.filter((s) => s.role === 'writer_composer' || s.role === 'lyricist');
    if (writerSplits.length > 0) {
      const totalWriterShare = writerSplits.reduce((sum, s) => sum + s.sharePercentage, 0);
      if (Math.abs(totalWriterShare - 100) > 0.01) {
        errors.push(`Writer splits must total exactly 100% (currently ${totalWriterShare}%)`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a deposit asset prior to Library of Congress upload.
 */
export function validateDepositAsset(asset: DepositAsset): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!asset.filename || asset.filename.trim().length === 0) {
    errors.push('Deposit filename is required');
  }

  if (asset.fileSizeBytes <= 0) {
    errors.push('Deposit file size must be greater than zero bytes');
  }

  if (!asset.sha256Checksum || !/^[a-f0-9]{64}$/i.test(asset.sha256Checksum)) {
    errors.push('Deposit asset requires a valid 64-character SHA-256 hexadecimal checksum');
  }

  const validMimes = ['audio/wav', 'audio/mpeg', 'audio/flac', 'application/pdf'];
  if (!validMimes.includes(asset.mimeType)) {
    errors.push(`Unsupported deposit MIME type: ${asset.mimeType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Builds a default structured Copilot Action sequence for a given portal target.
 */
export function generateCopilotActionPlan(manifest: RightsRegistrationManifest, target: PortalTarget): CopilotAction[] {
  const actions: CopilotAction[] = [];

  if (target === 'loc_copyright') {
    actions.push({
      id: 'loc-1',
      type: 'navigate',
      description: 'Navigate to US Copyright Office eCO Authentication Portal',
      value: 'https://eco.copyright.gov/ecoms/',
      requiresUserAction: false,
    });
    actions.push({
      id: 'loc-2',
      type: 'pause_for_user_auth',
      description: 'User enters eCO login credentials and completes CAPTCHA authentication',
      requiresUserAction: true,
    });
    actions.push({
      id: 'loc-3',
      type: 'autofill_input',
      description: `Populate Title of Work: "${manifest.work.title}"`,
      targetSelector: 'input#workTitle',
      targetFieldKey: 'work.title',
      value: manifest.work.title,
      requiresUserAction: false,
    });
    actions.push({
      id: 'loc-4',
      type: 'autofill_input',
      description: `Populate Year of Creation: ${manifest.work.yearOfCreation}`,
      targetSelector: 'input#creationYear',
      targetFieldKey: 'work.yearOfCreation',
      value: manifest.work.yearOfCreation,
      requiresUserAction: false,
    });
    actions.push({
      id: 'loc-5',
      type: 'autofill_input',
      description: `Populate Author / Claimant Legal Name: "${manifest.artistLegalName}"`,
      targetSelector: 'input#claimantName',
      targetFieldKey: 'artistLegalName',
      value: manifest.artistLegalName,
      requiresUserAction: false,
    });

    if (manifest.depositAssets.length > 0) {
      actions.push({
        id: 'loc-6',
        type: 'stage_deposit_upload',
        description: `Stage deposit copy for upload: ${manifest.depositAssets[0].filename} (SHA-256: ${manifest.depositAssets[0].sha256Checksum.slice(0, 8)}...)`,
        value: manifest.depositAssets[0].filename,
        requiresUserAction: false,
      });
    }

    actions.push({
      id: 'loc-7',
      type: 'pause_for_user_payment',
      description: 'User reviews official filing fee and enters payment details securely on Pay.gov',
      requiresUserAction: true,
    });
    actions.push({
      id: 'loc-8',
      type: 'extract_confirmation',
      description: 'Extract and record official Service Request (SR) number and timestamp',
      targetSelector: '.confirmation-number, #serviceRequestNumber',
      requiresUserAction: false,
    });
  } else if (target === 'the_mlc') {
    actions.push({
      id: 'mlc-1',
      type: 'navigate',
      description: 'Navigate to The MLC Portal',
      value: 'https://portal.themlc.com/',
      requiresUserAction: false,
    });
    actions.push({
      id: 'mlc-2',
      type: 'pause_for_user_auth',
      description: 'User enters MLC Portal credentials',
      requiresUserAction: true,
    });
    actions.push({
      id: 'mlc-3',
      type: 'autofill_input',
      description: `Register Musical Work: "${manifest.work.title}"`,
      targetSelector: 'input#mlcWorkTitle',
      targetFieldKey: 'work.title',
      value: manifest.work.title,
      requiresUserAction: false,
    });
    if (manifest.work.iswc) {
      actions.push({
        id: 'mlc-4',
        type: 'autofill_input',
        description: `Enter ISWC: ${manifest.work.iswc}`,
        targetSelector: 'input#iswc',
        targetFieldKey: 'work.iswc',
        value: manifest.work.iswc,
        requiresUserAction: false,
      });
    }
    actions.push({
      id: 'mlc-5',
      type: 'extract_confirmation',
      description: 'Extract The MLC Work Registration ID',
      targetSelector: '#workRegistrationId',
      requiresUserAction: false,
    });
  }

  return actions;
}
