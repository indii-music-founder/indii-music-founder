import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { LegalService } from '@/services/legal/LegalService';
import { ContractStatus } from '@/modules/legal/types';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types for LegalTools
// ============================================================================

export const LegalTools: Record<string, AnyToolFunction> = {
    draft_contract: wrapTool('draft_contract', async (args: {
        type: string;
        parties: string[];
        terms: string;
    }) => {
        // Input Validation
        if (!args.type || typeof args.type !== 'string') {
            throw new Error("Validation Error: 'type' is required and must be a string.");
        }
        if (!Array.isArray(args.parties) || args.parties.length === 0) {
            throw new Error("Validation Error: 'parties' must be a non-empty array of strings.");
        }

        const systemPrompt = `
You are a senior entertainment lawyer.
Draft a legally binding contract in Markdown format.
Start the document with a level 1 header "# LEGAL AGREEMENT".
Use standard legal language but keep it readable.
Ensure all parties and terms are clearly defined.
Common types: NDA, Model Release, Location Agreement, Sync License.
Structure with standard clauses: Definitions, Obligations, Term, Termination, Governing Law.
`;
        const prompt = `Draft a ${args.type} between ${args.parties.join(' and ')}.
Key Terms: ${args.terms}`;

        const response = await firebaseAI.generateContent(
            prompt,
            AI_MODELS.TEXT.AGENT,
            undefined,
            systemPrompt
        );

        const content = response.response.text();

        // Auto-persist the contract
        const title = `${args.type} - ${args.parties.join(' & ')}`;
        try {
            const contractId = await LegalService.saveContract({
                title,
                type: args.type,
                parties: args.parties,
                content,
                status: ContractStatus.DRAFT,
                metadata: { terms: args.terms }
            });
            return toolSuccess({
                content,
                contractId,
                title
            }, `Contract draft generated and saved to Legal Dashboard (ID: ${contractId})`);
        } catch (persistError) {
            logger.warn('[LegalTools] Failed to persist contract:', persistError);
            return toolSuccess({
                content
            }, "Contract generated but failed to save to dashboard (Persistence Error).");
        }
    }),

    generate_nda: wrapTool('generate_nda', async (args: {
        parties: string[];
        purpose: string;
    }) => {
        // We reuse the implementation but wrap it in a tool result correctly
        const result = await LegalTools.draft_contract!({
            type: 'Non-Disclosure Agreement',
            parties: args.parties,
            terms: `Purpose: ${args.purpose}. Standard confidentiality obligations apply.`
        });
        return result;
    }),

    generate_split_sheet: wrapTool('generate_split_sheet', async (args: {
        trackTitle: string;
        contributors: Array<{ name: string; role: string; percentage: number }>;
    }) => {
        // Validation
        const total = args.contributors.reduce((acc, c) => acc + c.percentage, 0);
        if (total !== 100) {
            return toolSuccess({ error: `Percentages must add up to 100%. Current total: ${total}%` }, 'Failed to generate split sheet');
        }

        const terms = `Track Title: ${args.trackTitle}\nContributors:\n` + args.contributors.map(c => `- ${c.name} (${c.role}): ${c.percentage}%`).join('\n');

        const result = await LegalTools.draft_contract!({
            type: 'Split Sheet',
            parties: args.contributors.map(c => c.name),
            terms: terms
        });

        return toolSuccess({
            ...result.data,
            splitSheetMessage: `Split sheet generated for "${args.trackTitle}"`
        }, result.message || `Split sheet generated for "${args.trackTitle}"`);
    }),

    trigger_digital_signature: wrapTool('trigger_digital_signature', async (args: {
        contractId: string;
        signers: Array<{ name: string; email: string }>;
        provider?: 'Docusign' | 'PandaDoc';
    }) => {
        const provider = args.provider || 'Docusign';
        logger.info(`[LegalTools] Triggering ${provider} API for contract ${args.contractId}`);

        // Item 111: Wire to digital signature Cloud Function
        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const sendForSigningFn = httpsCallable<
                { contractId: string; signers: Array<{ name: string; email: string }>; provider: string },
                { envelopeId: string; status: string; sentTo: string[] }
            >(functions, 'sendForDigitalSignature');

            const result = await sendForSigningFn({
                contractId: args.contractId,
                signers: args.signers,
                provider
            });

            return toolSuccess({
                contractId: args.contractId,
                provider,
                envelopeId: result.data.envelopeId,
                status: result.data.status,
                sentTo: result.data.sentTo
            }, `Digital signature requests sent via ${provider} to ${args.signers.length} signers.`);
        } catch (error) {
            logger.warn(`[LegalTools] ${provider} Cloud Function unavailable, using local tracking:`, error);
            const envelopeId = `env-${crypto.randomUUID()}`;

            // Persist signature request to Firestore for manual follow-up
            try {
                const { db, auth } = await import('@/services/firebase');
                const { collection, doc, setDoc } = await import('firebase/firestore');
                const userId = auth.currentUser?.uid;
                if (userId) {
                    await setDoc(doc(collection(db, `users/${userId}/signature_requests`)), {
                        contractId: args.contractId,
                        provider,
                        envelopeId,
                        signers: args.signers,
                        status: 'pending_manual',
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (e) {
                logger.warn('[LegalTools] Failed to persist signature request:', e);
            }

            return toolSuccess({
                contractId: args.contractId,
                provider,
                envelopeId,
                status: 'queued',
                sentTo: args.signers.map(s => s.email)
            }, `Digital signature requests queued via ${provider} for ${args.signers.length} signers. Deploy Cloud Function 'sendForDigitalSignature' for live ${provider} integration.`);
        }
    }),

    generate_dmca_takedown: wrapTool('generate_dmca_takedown', async (args: { infringingUrl: string; originalWorkTitle: string; rightsholderName: string }) => {
        // Pre-filled DMCA/Takedown Notices generator (Item 136)
        const draftText = `
**DMCA TAKEDOWN NOTICE**

To: Designated DMCA Agent

Dear Sir/Madam,

I am writing on behalf of ${args.rightsholderName} ("Rights Holder") to notify you of an infringement of copyright.

**Copyrighted Work:** "${args.originalWorkTitle}"
**Infringing Material URL:** ${args.infringingUrl}

The above-identified material is not authorized by the copyright owner, its agent, or the law and must be removed or access to it disabled.

**Statements Under Penalty of Perjury:**

1. I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law.
2. The information in this notice is accurate, and under penalty of perjury, I am authorized to act on behalf of the owner of the exclusive right that is allegedly infringed.
3. I acknowledge that under Section 512(f) of the DMCA, any person who knowingly materially misrepresents that material is infringing may be subject to liability.

**Contact Information:**
Name: ${args.rightsholderName}
Title: Authorized Representative
Date: ${new Date().toISOString().slice(0, 10)}

Signature: ____________________________
(Electronic signature accepted)
        `.trim();

        return toolSuccess({
            infringingUrl: args.infringingUrl,
            originalWorkTitle: args.originalWorkTitle,
            rightsholderName: args.rightsholderName,
            draftText: draftText,
            status: 'Complete Draft Created'
        }, `DMCA Takedown Notice generated for "${args.originalWorkTitle}" against URL ${args.infringingUrl}. Full statutory language included. Draft ready for review and sending.`);
    }),

    verify_mechanical_license: wrapTool('verify_mechanical_license', async (args: { trackTitle: string; originalArtist: string }) => {
        // Item 177: Mechanical License Verification via HFA/MusicReports
        // Calls Cloud Function that interfaces with HFA/MusicReports API,
        // persists check results to Firestore for audit trail.

        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const verifyFn = httpsCallable<
                { trackTitle: string; originalArtist: string },
                { status: string; songCode: string; publisher: string; rate: number; requiresClearance: boolean }
            >(functions, 'verifyMechanicalLicense');

            const result = await verifyFn({
                trackTitle: args.trackTitle,
                originalArtist: args.originalArtist,
            });

            // Persist the license check to Firestore
            try {
                const { db, auth } = await import('@/services/firebase');
                const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                const userId = auth.currentUser?.uid;
                if (userId) {
                    await addDoc(collection(db, `users/${userId}/mechanical_license_checks`), {
                        trackTitle: args.trackTitle,
                        originalArtist: args.originalArtist,
                        hfaStatus: result.data.status,
                        songCode: result.data.songCode,
                        publisher: result.data.publisher,
                        statutoryRate: result.data.rate,
                        requiresClearance: result.data.requiresClearance,
                        checkedAt: serverTimestamp(),
                    });
                }
            } catch (persistError) {
                logger.warn('[LegalTools] Failed to persist license check:', persistError);
            }

            return toolSuccess({
                coverSong: args.trackTitle,
                originalArtist: args.originalArtist,
                hfaStatus: result.data.status,
                songCode: result.data.songCode,
                publisher: result.data.publisher,
                statutoryRate: result.data.rate,
                requiresClearance: result.data.requiresClearance,
                link: 'https://www.songfile.com/',
            }, `Mechanical license verification for "${args.trackTitle}": Status=${result.data.status}, Publisher=${result.data.publisher}. ${result.data.requiresClearance ? 'Clearance required before delivery.' : 'License verified — cleared for delivery.'}`);
        } catch (error) {
            logger.warn('[LegalTools] verifyMechanicalLicense Cloud Function unavailable:', error);

            // Fallback: Persist the check request for manual processing
            try {
                const { db, auth } = await import('@/services/firebase');
                const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                const userId = auth.currentUser?.uid;
                if (userId) {
                    await addDoc(collection(db, `users/${userId}/mechanical_license_checks`), {
                        trackTitle: args.trackTitle,
                        originalArtist: args.originalArtist,
                        hfaStatus: 'pending_manual_verification',
                        requiresClearance: true,
                        checkedAt: serverTimestamp(),
                    });
                }
            } catch (persistError) {
                logger.warn('[LegalTools] Failed to persist fallback license check:', persistError);
            }

            return toolSuccess({
                coverSong: args.trackTitle,
                originalArtist: args.originalArtist,
                hfaStatus: 'Clearance Required',
                requiresClearance: true,
                userAcknowledged: false,
                link: 'https://www.songfile.com/',
            }, `Mechanical licensing verification required for cover song "${args.trackTitle}". Deploy Cloud Function 'verifyMechanicalLicense' for automated HFA/MusicReports checking. Manual clearance via SongFile is required before delivery.`);
        }
    })
};
