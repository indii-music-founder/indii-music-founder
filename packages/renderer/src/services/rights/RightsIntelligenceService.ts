import {
    projectClaimsInbox,
    evaluateRightsIntelligence,
    RightsIntelligenceReportSchema,
    type ClaimsInboxProjection,
    type ClaimsInboxInput,
    type RightsIntelligenceInput,
} from '@indii/shared';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

/** Adds a deterministic preflight to the existing release metadata object. */
export class RightsIntelligenceService {
    /**
     * Build the existing rights workflow's platform-neutral claims inbox view.
     * This read model preserves assertions and evidence; it does not determine
     * ownership, contact a platform, or persist a claim response.
     */
    projectClaims(input: ClaimsInboxInput): ClaimsInboxProjection {
        return projectClaimsInbox(input);
    }

    evaluate(
        metadata: ExtendedGoldenMetadata,
        input: RightsIntelligenceInput,
        evaluatedAt = new Date().toISOString(),
    ): ExtendedGoldenMetadata {
        const report = evaluateRightsIntelligence(input, evaluatedAt);
        const catalogImportPending = metadata.catalogImport !== undefined
            && metadata.catalogImport.status !== 'APPLIED';

        return {
            ...metadata,
            rightsIntelligence: catalogImportPending
                ? RightsIntelligenceReportSchema.parse({
                    ...report,
                    findings: [...report.findings, {
                        code: 'CATALOG_IMPORT_UNRESOLVED',
                        severity: 'BLOCKING',
                        entityId: input.targetEntityId,
                        message: 'Catalog import facts must be reviewed and applied before rights readiness can be assessed.',
                        requiresHumanReview: true,
                    }],
                    releaseReviewRequired: true,
                    contentIdAutomaticSubmissionEligible: false,
                })
                : report,
        };
    }
}

export const rightsIntelligenceService = new RightsIntelligenceService();
