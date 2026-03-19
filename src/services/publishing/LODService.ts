/**
 * LOD Service — Letter of Direction Generator
 *
 * Generates "Letter of Direction" documents via PandaDoc
 * for publishing administration changes. An LOD is used to
 * notify Performing Rights Organizations (PROs) and the MLC
 * that an artist has changed their publishing administrator.
 *
 * Workflow:
 * 1. Artist configures their publishing in onboarding
 * 2. When they sign a self-publishing agreement → ISWCService registers works
 * 3. LODService generates the LOD with pre-filled artist data
 * 4. LOD is sent to the PRO via PandaDoc (ASCAP, BMI, SESAC, etc.)
 */

import { pandaDocService } from '@/services/legal/PandaDocService';

export interface LODParams {
    /** Artist's legal name */
    artistLegalName: string;

    /** Artist's IPI number (from PRO registration) */
    artistIPI: string;

    /** The PRO this LOD is addressed to */
    targetPRO: 'ASCAP' | 'BMI' | 'SESAC' | 'GMR';

    /** The new publishing administrator's name */
    publisherName: string;

    /** The new publisher's IPI number */
    publisherIPI?: string;

    /** List of ISRCs being transferred */
    isrcList: string[];

    /** The effective date of the change (ISO 8601) */
    effectiveDate: string;

    /** Artist's email for signature */
    artistEmail: string;

    /** Optional: Catalog percentage transfer (default 100%) */
    sharePercentage?: number;
}

/** Known PandaDoc template IDs for LOD documents */
const LOD_TEMPLATES: Record<string, string> = {
    ASCAP: 'lod_ascap_template',
    BMI: 'lod_bmi_template',
    SESAC: 'lod_sesac_template',
    GMR: 'lod_gmr_template',
};

export class LODService {
    /**
     * Generate and send an LOD for a publishing admin change.
     *
     * @returns The PandaDoc document ID for tracking
     */
    static async generateLOD(params: LODParams): Promise<string> {
        const templateId = LOD_TEMPLATES[params.targetPRO];

        // Build tokens for template population
        const tokens: Record<string, string> = {
            'artist_legal_name': params.artistLegalName,
            'artist_ipi': params.artistIPI,
            'target_pro': params.targetPRO,
            'publisher_name': params.publisherName,
            'publisher_ipi': params.publisherIPI || 'N/A',
            'effective_date': params.effectiveDate,
            'share_percentage': `${params.sharePercentage ?? 100}%`,
            'isrc_list': params.isrcList.join(', '),
            'isrc_count': params.isrcList.length.toString(),
            'current_date': new Date().toISOString().split('T')[0]!,
        };

        // Create the document
        const doc = await pandaDocService.createDocument({
            name: `LOD — ${params.artistLegalName} to ${params.targetPRO} (${params.effectiveDate})`,
            templateId,
            recipients: [
                {
                    email: params.artistEmail,
                    firstName: params.artistLegalName.split(' ')[0]!,
                    lastName: params.artistLegalName.split(' ').slice(1).join(' ') || '',
                    role: 'Artist',
                    signingOrder: 1,
                },
            ],
            tokens,
            tags: ['LOD', params.targetPRO, 'publishing'],
        });

        return doc.id;
    }

    /**
     * Check the status of a previously generated LOD.
     */
    static async getLODStatus(documentId: string) {
        return pandaDocService.getDocumentStatus(documentId);
    }

    /**
     * Send an existing LOD for e-signature.
     */
    static async sendLOD(documentId: string, message?: string): Promise<void> {
        await pandaDocService.sendDocument(
            documentId,
            message || 'Please review and sign this Letter of Direction to authorize the publishing administration change.',
            'Letter of Direction — Action Required'
        );
    }
}
