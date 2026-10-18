/**
 * RightsCopilotService.ts
 *
 * Client-side orchestration service for ISSUE-1511:
 * Assisted Rights Registration Engine — Screen Control & Browser Copilot
 * for Official Music Rights Infrastructure (US Copyright Office eCO, The MLC, PROs, SoundExchange).
 *
 * Translates artist catalog & passport diagnostic telemetry into validated filing manifests
 * and deterministic browser action sequences.
 */

import {
  createRegistrationFilingRecord,
  DepositAsset,
  generateCopilotActionPlan,
  PortalTarget,
  type RegistrationFilingRecord,
  RightsRegistrationManifest,
  validateDepositAsset,
  validateRegistrationManifest,
  type CopilotAction,
  type ProspectAssessment,
} from '@indii/shared';

export interface ManifestCreationOptions {
  title?: string;
  artistLegalName?: string;
  artistStageName?: string;
  yearOfCreation?: number;
  isrc?: string;
  iswc?: string;
  splits?: Array<{
    legalName: string;
    role: 'writer_composer' | 'lyricist' | 'producer' | 'featured_performer' | 'master_owner';
    sharePercentage: number;
    ipiCaeNumber?: string;
  }>;
}

export class RightsCopilotService {
  /**
   * Translates a ProspectAssessment intake (or studio release profile) into a canonical RightsRegistrationManifest.
   * Auto-identifies appropriate target portals based on diagnosed rights gaps.
   */
  createManifestFromPassport(
    assessment: Partial<ProspectAssessment>,
    options?: ManifestCreationOptions,
  ): RightsRegistrationManifest {
    const artistLegalName = options?.artistLegalName || '';
    const artistStageName = options?.artistStageName || assessment.artistName;
    const workTitle = options?.title || '';
    const currentYear = new Date().getFullYear();
    const creationYear = options?.yearOfCreation || currentYear;

    const targetPortals: PortalTarget[] = [];

    // Evaluate MLC gap
    if (assessment.mlcRegistered === 'No' || assessment.mlcRegistered === 'Not sure' || assessment.mlcRegistered === 'Unsure') {
      targetPortals.push('the_mlc');
    }

    // Evaluate PRO gap
    if (!assessment.proAffiliation || assessment.proAffiliation === 'None') {
      targetPortals.push('bmi');
    }

    // Official US Copyright is essential for every master release
    targetPortals.push('loc_copyright');

    // Add SoundExchange for master performance rights
    targetPortals.push('soundexchange');

    const splits = options?.splits || [];

    const manifest: RightsRegistrationManifest = {
      manifestId: `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      artistId: assessment.id || 'unassigned',
      artistLegalName,
      artistStageName,
      citizenshipOrDomicile: '',
      targetPortals,
      copyrightFormType: 'Form_SR',
      work: {
        title: workTitle,
        yearOfCreation: creationYear,
        isPublished: false,
        isrc: options?.isrc,
        iswc: options?.iswc,
      },
      splits,
      depositAssets: [],
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    return manifest;
  }

  /**
   * Generates the step-by-step browser copilot action plan for the target portal.
   */
  getActionPlan(manifest: RightsRegistrationManifest, target: PortalTarget): CopilotAction[] {
    return generateCopilotActionPlan(manifest, target);
  }

  /**
   * Computes SHA-256 hexadecimal checksum for a deposit audio file buffer using Web Crypto API.
   */
  async computeAudioChecksum(buffer: ArrayBuffer | Uint8Array): Promise<string> {
    const rawBuffer: ArrayBuffer = buffer instanceof Uint8Array ? (buffer.slice().buffer as ArrayBuffer) : buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', rawBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Adds and validates a deposit asset on an existing manifest.
   */
  attachDeposit(
    manifest: RightsRegistrationManifest,
    asset: DepositAsset,
  ): { manifest: RightsRegistrationManifest; isValid: boolean; errors: string[] } {
    const validation = validateDepositAsset(asset);
    if (!validation.isValid) {
      return {
        manifest,
        isValid: false,
        errors: validation.errors,
      };
    }

    const updated: RightsRegistrationManifest = {
      ...manifest,
      depositAssets: [...manifest.depositAssets, asset],
      updatedAtMs: Date.now(),
    };

    return {
      manifest: updated,
      isValid: true,
      errors: [],
    };
  }

  /**
   * Generates an exportable filing brief / data room memo for the artist and their legal records.
   */
  generateFilingBrief(manifest: RightsRegistrationManifest): string {
    const validation = validateRegistrationManifest(manifest);
    const portalsList = manifest.targetPortals.map((p) => `- ${p.toUpperCase().replace('_', ' ')}`).join('\n');
    const splitsList = manifest.splits
      .map((s) => `- ${s.legalName} (${s.role}): ${s.sharePercentage}%${s.ipiCaeNumber ? ` [IPI: ${s.ipiCaeNumber}]` : ''}`)
      .join('\n');
    const depositsList = manifest.depositAssets.length > 0
      ? manifest.depositAssets
          .map((d) => `- ${d.filename} (${(d.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) • SHA-256: ${d.sha256Checksum}`)
          .join('\n')
      : '- None attached yet';

    return `# indii Rights Registration Dossier
**Work Title:** ${manifest.work.title}
**Claimant:** ${manifest.artistLegalName}${manifest.artistStageName ? ` (p/k/a ${manifest.artistStageName})` : ''}
**Year of Creation:** ${manifest.work.yearOfCreation}
**ISRC:** ${manifest.work.isrc || 'Pending assignment'}
**Manifest ID:** ${manifest.manifestId}
**Validation Status:** ${validation.isValid ? 'VALID' : 'REQUIRES ATTENTION'}

### Target Registration Portals:
${portalsList}

### Contributor Splits:
${splitsList}

### Verified Deposit Copies (Library of Congress eCO):
${depositsList}

*Generated by indii Connected Intelligence© Rights Copilot on ${new Date().toISOString().split('T')[0]}*`;
  }

  /**
   * Records a verified filing confirmation or Service Request (SR) ID into a tamper-evident RegistrationFilingRecord.
   */
  recordFilingConfirmation(
    manifest: RightsRegistrationManifest,
    portalTarget: PortalTarget,
    confirmation: {
      confirmationNumber: string;
      serviceRequestId?: string;
      filingFeeUsd?: number;
      officialFilingDate?: string;
    },
  ): RegistrationFilingRecord {
    return createRegistrationFilingRecord(manifest, portalTarget, confirmation);
  }
}

export const rightsCopilotService = new RightsCopilotService();
