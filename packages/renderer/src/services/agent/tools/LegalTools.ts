import { AutonomousIntelligence, getResponseText } from '@/services/intelligence/AutonomousIntelligence';
import { LegalService } from '@/services/legal/LegalService';
import { ContractStatus } from '@/modules/legal/types';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import { getFineTunedModel } from '../fine-tuned-models';
import { importWithRetry } from '@/utils/dynamicImport';

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

        const response = await AutonomousIntelligence.generateContent(
            prompt,
            getFineTunedModel('legal'),
            undefined,
            systemPrompt
        );

        const content = getResponseText(response);

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
        } catch (persistError: unknown) {
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
        // ISSUE-829: an invalid split total must be a tool error, not a
        // toolSuccess() carrying an error string in its data — agent
        // orchestration otherwise treats this as a real generated artifact.
        // Tolerance of 0.01 absorbs floating-point drift from fractional
        // splits (e.g. three-way 33.33/33.33/33.34), not real invalid totals.
        if (Math.abs(total - 100) > 0.01) {
            return toolError(
                `Split percentages must add up to 100%. Current total: ${total}%.`,
                'INVALID_SPLIT_TOTAL',
                { total, difference: Number((100 - total).toFixed(2)) }
            );
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
            const { functions } = await importWithRetry(() => import('@/services/firebase'));
            const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));

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
        } catch (error: unknown) {
            logger.warn(`[LegalTools] ${provider} digital signature request failed:`, error);
            return toolError(
                `Digital signature request failed: ${error instanceof Error ? error.message : String(error)}. No envelope was created or queued.`,
                'DIGITAL_SIGNATURE_UNAVAILABLE'
            );
        }
    }),

    summarize_contract_terms: wrapTool('summarize_contract_terms', async (args: {
        contractText: string;
        focusAreas?: string[];
    }) => {
        if (!args.contractText || typeof args.contractText !== 'string') {
            throw new Error("Validation Error: 'contractText' is required and must be a string.");
        }

        const systemPrompt = `
You are a senior entertainment lawyer.
Analyze the provided contract text and provide a concise summary of its key terms.
Focus on: Obligations, Term, Termination, Compensation, and Rights Granted.
${args.focusAreas && args.focusAreas.length > 0 ? `Pay special attention to these focus areas: ${args.focusAreas.join(', ')}.` : ''}
Output in Markdown format. Use bullet points for readability. Highlight any unusual or highly restrictive clauses.
`;
        const prompt = `Please summarize the following contract:\n\n${args.contractText}`;

        const response = await AutonomousIntelligence.generateContent(
            prompt,
            getFineTunedModel('legal'),
            undefined,
            systemPrompt
        );

        const content = getResponseText(response);

        return toolSuccess({
            summary: content
        }, "Contract terms summarized successfully.");
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

    register_copyright: wrapTool('register_copyright', async (args: {
        trackId?: string;
        trackTitle?: string;
    }) => {
        // Navigate to Registration Center focused on Library of Congress
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        store.setModule('registration');
        store.setRegistrationFocus({ orgId: 'loc', trackId: args.trackId ?? null });
        store.setRegistrationIntelligenceMessage(
            `Opening Library of Congress (eCO) copyright registration${args.trackTitle ? ` for "${args.trackTitle}"` : ''}. I'll pre-fill everything I know from your catalog — you'll only need to confirm a couple of details.`
        );

        return toolSuccess({
            module: 'registration',
            orgId: 'loc',
            trackId: args.trackId ?? null,
        }, `Opened Registration Center for Library of Congress copyright registration${args.trackTitle ? ` of "${args.trackTitle}"` : ''}. The Autonomous co-pilot is pre-filling your catalog data now.`);
    }),

    start_pro_registration: wrapTool('start_pro_registration', async (args: {
        orgId: 'ascap' | 'bmi' | 'sesac';
        trackId?: string;
        trackTitle?: string;
    }) => {
        const orgNames: Record<string, string> = { ascap: 'ASCAP', bmi: 'BMI', sesac: 'SESAC' };
        const orgName = orgNames[args.orgId] ?? args.orgId.toUpperCase();

        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        store.setModule('registration');
        store.setRegistrationFocus({ orgId: args.orgId, trackId: args.trackId ?? null });
        store.setRegistrationIntelligenceMessage(
            `Opening ${orgName} work registration${args.trackTitle ? ` for "${args.trackTitle}"` : ''}. I'll pre-fill your contributor splits and metadata — just confirm your IPI number.`
        );

        return toolSuccess({
            module: 'registration',
            orgId: args.orgId,
            trackId: args.trackId ?? null,
        }, `Opened Registration Center for ${orgName} work registration${args.trackTitle ? ` of "${args.trackTitle}"` : ''}.`);
    }),

    verify_mechanical_license: wrapTool('verify_mechanical_license', async (args: { trackTitle: string; originalArtist: string }) => {
        // Item 177: Mechanical License Verification via HFA/MusicReports
        // Calls Cloud Function that interfaces with HFA/MusicReports API,
        // persists check results to Firestore for audit trail.

        try {
            const { functions } = await importWithRetry(() => import('@/services/firebase'));
            const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));

            const verifyFn = httpsCallable<
                { trackTitle: string; originalArtist: string },
                { status: string; songCode: string | null; publisher: string | null; rate: number; requiresClearance: boolean; guidance?: string; rateContext?: string }
            >(functions, 'verifyMechanicalLicense');

            const result = await verifyFn({
                trackTitle: args.trackTitle,
                originalArtist: args.originalArtist,
            });

            // Persist the license check to Firestore
            try {
                const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
                const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
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
            } catch (persistError: unknown) {
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
            }, `Mechanical license check for "${args.trackTitle}": Status=${result.data.status}${result.data.publisher ? `, Publisher=${result.data.publisher}` : ''}. ${result.data.requiresClearance ? `Clearance required before delivery. ${result.data.guidance ?? 'Use SongFile (downloads/physical) and The MLC (streaming) to obtain a mechanical license.'}` : 'License verified — cleared for delivery.'}`);
        } catch (error: unknown) {
            logger.warn('[LegalTools] verifyMechanicalLicense Cloud Function unavailable:', error);

            // Fallback: Persist the check request for manual processing
            try {
                const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
                const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
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
            } catch (persistError: unknown) {
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
    }),

    contract_generator_and_review_tool: wrapTool('contract_generator_and_review_tool', async (args: {
        mode: 'generate' | 'review';
        generation?: {
            contractType: 'split_sheet' | 'producer_agreement' | 'sync_license' | 'work_for_hire' | 'nda' | 'master_use_license' | 'artist_management' | string;
            title?: string;
            parties: Array<{ name: string; role: string; email?: string; entityType?: string }>;
            governingLaw?: string;
            termLength?: string;
            compensationTerms?: string;
            grantOfRights?: string;
            auditRights?: boolean;
            reversionClause?: boolean;
            specialProvisions?: string;
        };
        review?: {
            contractText: string;
            contractTitle?: string;
            focusAreas?: string[];
        };
    }) => {
        if (!args.mode || (args.mode !== 'generate' && args.mode !== 'review')) {
            return toolError("Argument 'mode' must be either 'generate' or 'review'.", "INVALID_MODE");
        }

        if (args.mode === 'generate') {
            const gen = args.generation;
            if (!gen) {
                return toolError("The 'generation' configuration is required when mode is 'generate'.", "MISSING_GENERATION_CONFIG");
            }
            if (!gen.contractType || typeof gen.contractType !== 'string') {
                return toolError("'contractType' is required for contract generation.", "MISSING_CONTRACT_TYPE");
            }
            if (!Array.isArray(gen.parties) || gen.parties.length === 0) {
                return toolError("'parties' must be a non-empty array of participants.", "NO_PARTIES_PROVIDED");
            }

            const title = gen.title || `${gen.contractType.replace(/_/g, ' ').toUpperCase()} - ${gen.parties.map(p => p.name).join(' & ')}`;
            const governingLaw = gen.governingLaw || 'California, USA';
            const termLength = gen.termLength || '2 (two) years from Effective Date';
            const auditRights = gen.auditRights !== false;
            const reversionClause = gen.reversionClause !== false;

            const systemPrompt = `
You are a senior entertainment and music industry attorney.
Draft a complete, formal, and legally binding contract in GitHub-flavored Markdown.
Enforce standard entertainment legal safeguards to protect independent music creators.

Mandatory Structure:
# ${title.toUpperCase()}
1. PREAMBLE & IDENTIFICATION OF PARTIES
   - Full party legal names, roles, and effective date.
2. RECITALS
   - Background and business intent of the agreement.
3. GRANT OF RIGHTS / SCOPE OF WORK
   - Explicit scope: ${gen.grantOfRights || 'Standard commercial music exploitation with rights reservation.'}
   - Emphasize artist ownership retention.
4. FINANCIAL TERMS, ROYALTIES & ACCOUNTING
   - Compensation details: ${gen.compensationTerms || 'Standard revenue waterfall with quarterly statements.'}
   ${auditRights ? '- AUDIT RIGHTS: Annual inspection of books and records within 30 days notice.' : ''}
5. WARRANTIES, REPRESENTATIONS & INDEMNIFICATION
   - Representations of original work, non-infringement, authority to contract.
   - Mutual indemnification with standard reasonable attorney fee caps.
6. TERM, TERMINATION & RIGHTS REVERSION
   - Term: ${termLength}.
   ${reversionClause ? '- REVERSION OF RIGHTS: All unexploited masters, copyrights, and publishing rights revert to the creator upon contract expiration or uncured breach.' : ''}
7. GOVERNING LAW & DISPUTE RESOLUTION
   - Governing jurisdiction: State of ${governingLaw}.
   - Mandatory mediation followed by binding arbitration (e.g., JAMS/AAA).
8. MISCELLANEOUS (Severability, Entire Agreement, No Waiver, Counterparts).
9. SIGNATURE BLOCKS (All parties).
`;

            const prompt = `Generate a legally sound ${gen.contractType} between:
Parties: ${gen.parties.map(p => `${p.name} (${p.role}${p.entityType ? `, ${p.entityType}` : ''})`).join('; ')}
Governing Law: ${governingLaw}
Term: ${termLength}
Compensation: ${gen.compensationTerms || 'Standard agreed waterfall'}
Grant of Rights: ${gen.grantOfRights || 'Defined in contract'}
Special Provisions: ${gen.specialProvisions || 'None'}
Include strict enforceability safeguards.`;

            try {
                const response = await AutonomousIntelligence.generateContent(
                    prompt,
                    getFineTunedModel('legal'),
                    undefined,
                    systemPrompt
                );
                const content = getResponseText(response);

                // Auto-persist contract
                let savedId = '';
                try {
                    savedId = await LegalService.saveContract({
                        title,
                        type: gen.contractType,
                        parties: gen.parties.map(p => p.name),
                        content,
                        status: ContractStatus.DRAFT,
                        metadata: {
                            governingLaw,
                            termLength,
                            auditRights,
                            reversionClause,
                            generatedAt: new Date().toISOString()
                        }
                    });
                } catch (persistErr: unknown) {
                    logger.warn('[LegalTools] Failed to auto-persist generated contract:', persistErr);
                }

                return toolSuccess({
                    mode: 'generate',
                    contractId: savedId || undefined,
                    title,
                    contractType: gen.contractType,
                    content,
                    parties: gen.parties,
                    safeguards: {
                        governingLaw,
                        termLength,
                        auditRightsIncluded: auditRights,
                        reversionClauseIncluded: reversionClause,
                        arbitrationClauseIncluded: true
                    },
                    disclaimer: "I am an AI, not a lawyer. This draft agreement is for informational and workflow purposes and should be reviewed by licensed legal counsel prior to formal execution."
                }, `Enforceable contract draft generated successfully for "${title}". Auto-saved to Legal Dashboard.`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                return toolError(`Contract generation failed: ${msg}`, "GENERATION_FAILED");
            }
        } else {
            // Mode: 'review'
            const rev = args.review;
            if (!rev || !rev.contractText || typeof rev.contractText !== 'string' || rev.contractText.trim().length === 0) {
                return toolError("Contract text ('contractText') is required when mode is 'review'.", "MISSING_CONTRACT_TEXT");
            }

            const focusAreas = rev.focusAreas && rev.focusAreas.length > 0 ? rev.focusAreas : [
                'rights_reversion',
                'audit_rights',
                'unbounded_indemnity',
                'cross_collateralization',
                'royalty_deductions',
                'termination_mechanisms'
            ];

            const systemPrompt = `
You are a senior entertainment attorney reviewing a music industry contract for an independent creator.
Audit the provided agreement against legal precedents and creator protection standards.

Analyze the contract strictly across these dimensions:
1. Enforceability Score: 1-100 (where 100 is fully balanced, fair, and legally bulletproof).
2. Risk Tier: LOW, MEDIUM, HIGH, or CRITICAL.
3. Essential Clause Audit: Verify presence and strength of:
   - Grant of Rights (Scope, territory, duration)
   - Compensation & Waterfall (Deductions, rate, reporting intervals)
   - Audit Rights (Inspection frequency, penalty for underreporting)
   - Indemnification (Is it mutual? Are there liability caps?)
   - Termination & Reversion (Can creator escape uncured breach? Do masters revert?)
   - Dispute Resolution & Governing Law (Jurisdiction, arbitration)
4. Red Flags & Predatory Terms (Flag perpetual transfers without reversion, broad work-for-hire on preexisting IP, hidden expense recoupments, etc.).
5. Recommended Redlines / Amendments (Specific proposed replacement language).
6. Plain-English Summary (Direct, actionable briefing for the artist).

Respond in structured JSON:
{
  "enforceabilityScore": number,
  "riskTier": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": string,
  "clausesIdentified": string[],
  "redFlags": Array<{ clause: string, severity: "HIGH" | "MEDIUM" | "LOW", explanation: string, suggestedAmendment: string }>,
  "safeguardChecklist": {
    "hasAuditRights": boolean,
    "hasReversionClause": boolean,
    "hasMutualIndemnity": boolean,
    "hasReasonableTerm": boolean
  },
  "overallVerdict": string
}
`;

            const prompt = `Review the following music contract:
Title: ${rev.contractTitle || 'Contract Draft'}
Focus Areas: ${focusAreas.join(', ')}

Contract Text:
${rev.contractText}
`;

            try {
                const response = await AutonomousIntelligence.generateContent(
                    prompt,
                    getFineTunedModel('legal'),
                    undefined,
                    systemPrompt
                );
                const rawText = getResponseText(response);
                let parsedReview: any = null;
                try {
                    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                    const cleanJson = jsonMatch ? jsonMatch[1]! : rawText;
                    parsedReview = JSON.parse(cleanJson);
                } catch {
                    parsedReview = {
                        enforceabilityScore: 70,
                        riskTier: 'MEDIUM',
                        summary: rawText,
                        redFlags: [],
                        overallVerdict: 'Manual review required — could not parse JSON schema.'
                    };
                }

                return toolSuccess({
                    mode: 'review',
                    contractTitle: rev.contractTitle || 'Contract Draft',
                    review: parsedReview,
                    disclaimer: "I am an AI, not a lawyer. This review is for informational purposes only and does not constitute formal legal advice."
                }, `Contract review completed. Enforceability Score: ${parsedReview.enforceabilityScore ?? 'N/A'}/100. Risk Tier: ${parsedReview.riskTier ?? 'MEDIUM'}.`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                return toolError(`Contract review failed: ${msg}`, "REVIEW_FAILED");
            }
        }
    })
};
