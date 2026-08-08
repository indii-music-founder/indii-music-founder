import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { HarnessCompiler, HarnessContext } from './HarnessCompiler';
import { createHarnessRun, type HarnessRun } from './types';
import { buildDistributionReadiness } from '../release-harness/ReleaseHarnessAdapters';
import type { DdexDeliveryAuthorityEvidence } from '../release-harness/types';

export interface DistributionDdexInput {
  metadata?: Partial<ExtendedGoldenMetadata>;
  selectedStores?: string[];
  deliveryAuthority?: DdexDeliveryAuthorityEvidence;
  trackId?: string;
}

export interface DistributionDdexHarnessOutput {
  readiness: ReturnType<typeof buildDistributionReadiness>;
}

export class DistributionDdexCompiler implements HarnessCompiler<DistributionDdexInput, DistributionDdexHarnessOutput> {
  readonly domain = 'distribution_ddex';

  compile(input: DistributionDdexInput, ctx: HarnessContext): HarnessRun<DistributionDdexHarnessOutput> {
    const metadata = input.metadata ?? {};
    const distributionReadiness = buildDistributionReadiness({
      metadata,
      selectedStores: input.selectedStores,
      deliveryAuthority: input.deliveryAuthority,
    });

    return createHarnessRun<DistributionDdexHarnessOutput>({
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [
        ...(input.trackId ? [{ type: 'track' as const, id: input.trackId, label: metadata.trackTitle }] : []),
        ...(metadata.isrc ? [{ type: 'track' as const, id: metadata.isrc, label: 'ISRC' }] : []),
        ...(metadata.upc ? [{ type: 'release' as const, id: metadata.upc, label: 'UPC' }] : []),
      ],
      scores: [{
        label: 'DDEX Readiness',
        value: distributionReadiness.ddexPackageReady ? 100 : distributionReadiness.metadataComplete ? 70 : 35,
        max: 100,
        status: distributionReadiness.ddexPackageReady ? 'good' : distributionReadiness.metadataComplete ? 'watch' : 'blocked',
        rationale: distributionReadiness.ddexPackageReady
          ? 'Metadata, identifiers, sender authority, recipient onboarding, credentials, feed profiles, and validation receipts are verified.'
          : distributionReadiness.metadataComplete
            ? 'Metadata is complete, but verified delivery-authority evidence is missing or incomplete.'
            : 'Release metadata, identifiers, or rights fields are incomplete.',
      }],
      findings: [
        ...distributionReadiness.missingFields.map((field, index) => ({
          id: `missing_distribution_field_${index}`,
          domain: 'distribution_ddex' as const,
          severity: 'high' as const,
          title: `Missing ${field}`,
          detail: `${field} is required before direct-to-storefront delivery.`,
          confidence: 'high' as const,
        })),
        ...distributionReadiness.rightsWarnings.map((warning, index) => ({
          id: `distribution_rights_warning_${index}`,
          domain: 'distribution_ddex' as const,
          severity: 'high' as const,
          title: 'Rights warning',
          detail: warning,
          confidence: 'high' as const,
        })),
        ...distributionReadiness.authorityBlockers.map((blocker, index) => ({
          id: `distribution_authority_blocker_${index}`,
          domain: 'distribution_ddex' as const,
          severity: 'high' as const,
          title: 'Delivery authority not verified',
          detail: blocker,
          confidence: 'high' as const,
        })),
      ],
      recommendations: [{
        id: 'complete_ddex_readiness',
        domain: this.domain,
        priority: distributionReadiness.ddexPackageReady ? 'low' : 'high',
        title: distributionReadiness.ddexPackageReady ? 'Hold for user delivery approval' : 'Complete DDEX readiness blockers',
        detail: distributionReadiness.ddexPackageReady
          ? 'The package can be prepared, but delivery remains blocked until explicit user approval.'
          : 'Resolve missing identifiers, metadata, rights, sender authority, recipient onboarding, credentials, feed profiles, and validation receipts before delivery.',
        ownerAgentId: 'distribution',
        approvalRequired: true,
        nextAction: distributionReadiness.ddexPackageReady ? 'Ask user for delivery approval.' : 'Open release metadata and identifier checklist.',
      }],
      costLines: [],
      legalBasis: [],
      evidenceRefs: [
        ...(input.deliveryAuthority?.sender?.evidenceRef ? [{
          id: input.deliveryAuthority.sender.evidenceRef,
          type: 'identifier' as const,
          label: 'Verified sender DPID evidence',
          value: input.deliveryAuthority.sender.dpid,
        }] : []),
        ...Object.entries(input.deliveryAuthority?.recipients ?? {}).flatMap(([store, recipient]) =>
          recipient.validationReceipt?.receiptId ? [{
            id: recipient.validationReceipt.receiptId,
            type: 'document' as const,
            label: `${store} validation receipt`,
            value: recipient.validationReceipt.status,
          }] : []
        ),
      ],
      agentBriefs: [{
        agentId: 'distribution',
        departmentId: 'distribution',
        brief: 'Prepare release delivery readiness, identifier checklist, territory/storefront blockers, and no-delivery approval gate.',
        inputs: [...distributionReadiness.missingFields, ...distributionReadiness.authorityBlockers],
        blockedBy: distributionReadiness.ddexPackageReady
          ? ['User delivery approval required']
          : [...distributionReadiness.missingFields, ...distributionReadiness.authorityBlockers],
      }, {
        agentId: 'legal',
        departmentId: 'legal',
        brief: 'Review rights warnings, samples, covers, AI disclosure, and direct storefront delivery risks.',
        inputs: distributionReadiness.rightsWarnings,
      }],
      approvalGates: [{
        id: 'ddex_delivery_user_approval',
        label: 'Direct storefront delivery approval',
        reason: 'DDEX delivery is irreversible or externally visible and must be approved by the user.',
        requiredFor: 'deliver to DSP',
        riskTier: 'approval',
      }],
      assumptions: ['DDEX delivery is never authorized by this harness. It only prepares readiness.'],
      confidence: distributionReadiness.ddexPackageReady ? 0.9 : distributionReadiness.metadataComplete ? 0.65 : 0.42,
      output: { readiness: distributionReadiness },
    });
  }
}

export const distributionDdexCompiler = new DistributionDdexCompiler();
