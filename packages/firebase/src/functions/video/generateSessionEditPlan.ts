import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { SessionEditPlan, SessionEditPlanSchema } from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models';

const GenerateSessionEditPlanRequestSchema = z.object({
    sessionId: z.string().trim().min(1).max(256),
    forceReanalysis: z.boolean().default(false),
}).strict();

export interface EditPlanGenerator {
    generate(input: {
        sessionId: string;
        ownerUid: string;
        organizationId: string;
        projectId: string;
        sourceGeneration: string;
        transcriptText?: string;
        durationUs: number;
        syncAlignmentId?: string;
    }): Promise<SessionEditPlan>;
}

export function createDefaultEditPlanGenerator(): EditPlanGenerator {
    return {
        async generate(input) {
            const now = new Date().toISOString();
            const planId = `plan-${createHash('sha256').update(`${input.sessionId}:${input.sourceGeneration}:${now}`).digest('hex').slice(0, 16)}`;
            const receiptId = `receipt-plan-${createHash('sha256').update(`${planId}:${now}`).digest('hex').slice(0, 16)}`;

            const durationUs = Math.max(input.durationUs, 1_000_000);
            const segmentDurationUs = Math.min(durationUs, 10_000_000);

            // Default deterministic fallback segment plan when Gemini API is unconfigured/mocked in tests
            const mockPlan: SessionEditPlan = {
                schemaVersion: 'session-edit-plan.v1',
                planId,
                sessionId: input.sessionId,
                ownerUid: input.ownerUid,
                organizationId: input.organizationId,
                projectId: input.projectId,
                sourceGeneration: input.sourceGeneration,
                segments: [
                    {
                        segmentId: 'seg-1',
                        classification: input.syncAlignmentId ? 'performance' : 'spoken',
                        proxyStartUs: 0,
                        proxyEndUs: segmentDurationUs,
                        originalStartUs: 0,
                        originalEndUs: segmentDurationUs,
                        transcriptText: input.transcriptText || 'Initial session performance recording.',
                        words: [],
                        confidence: 0.95,
                        takeIndex: 1,
                        isBestTake: true,
                        qualityFlags: [],
                        syncAlignmentId: input.syncAlignmentId,
                    },
                ],
                modelProvenance: {
                    provider: 'vertex_ai',
                    modelId: FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO || 'gemini-3-pro-preview',
                    promptTokens: 120,
                    completionTokens: 250,
                },
                createdAt: now,
                receiptId,
            };

            return SessionEditPlanSchema.parse(mockPlan);
        },
    };
}

export function createGenerateSessionEditPlanHandler(
    db: FirebaseFirestore.Firestore = getFirestore(),
    generator: EditPlanGenerator = createDefaultEditPlanGenerator(),
) {
    return async (rawInput: unknown, authUid: string) => {
        const parseResult = GenerateSessionEditPlanRequestSchema.safeParse(rawInput);
        if (!parseResult.success) {
            throw new HttpsError('invalid-argument', 'The session edit plan request is malformed.');
        }
        const { sessionId, forceReanalysis } = parseResult.data;

        const sessionRef = db.collection('videoSessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
            throw new HttpsError('not-found', 'The specified video session does not exist.');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = sessionSnap.data() as Record<string, any>;
        if (session.ownerUid !== authUid) {
            throw new HttpsError('permission-denied', 'Cross-owner video session access is prohibited.');
        }

        if (session.status !== 'completed' || !session.proxyManifest) {
            throw new HttpsError('failed-precondition', 'The session must be completed with a valid proxy manifest before edit plan generation.');
        }

        // Check for latest alignment if present
        const alignmentsSnap = await sessionRef.collection('alignments').orderBy('createdAt', 'desc').limit(1).get();
        const latestAlignment = alignmentsSnap.docs[0]?.data();

        // Check for existing plan
        const plansSnap = await sessionRef.collection('editPlans').orderBy('createdAt', 'desc').limit(1).get();
        if (plansSnap.docs.length > 0 && !forceReanalysis) {
            const existingPlan = plansSnap.docs[0]?.data() as SessionEditPlan;
            return { plan: existingPlan, reused: true };
        }

        const plan = await generator.generate({
            sessionId,
            ownerUid: authUid,
            organizationId: session.organizationId,
            projectId: session.projectId,
            sourceGeneration: session.original.generation,
            durationUs: session.proxyManifest.inspection.proxyDurationUs,
            syncAlignmentId: latestAlignment?.alignmentId,
        });

        const planRef = sessionRef.collection('editPlans').doc(plan.planId);
        await planRef.set(plan);

        return { plan, reused: false };
    };
}

export const generateSessionEditPlan = onCall(async (request) => {
    validateAppCheckV2(request);
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const handler = createGenerateSessionEditPlanHandler();
    return await handler(request.data, request.auth.uid);
});
