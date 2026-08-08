import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import type { Models } from '@google/genai';
import {
    SessionEditPlan,
    SessionEditPlanSchema,
    SessionSegmentClassificationSchema,
    SegmentQualityFlagSchema,
    type PresentationTimeMap,
} from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models';
import { getVertexAIClient } from '../../lib/vertexClient';

const GenerateSessionEditPlanRequestSchema = z.object({
    sessionId: z.string().trim().min(1).max(256),
    forceReanalysis: z.boolean().default(false),
}).strict();

const GeneratedEditPlanSchema = z.object({
    segments: z.array(z.object({
        classification: SessionSegmentClassificationSchema,
        proxyStartUs: z.number().int().nonnegative(),
        proxyEndUs: z.number().int().positive(),
        transcriptText: z.string().max(20_000),
        confidence: z.number().min(0).max(1),
        takeIndex: z.number().int().nonnegative().optional(),
        isBestTake: z.boolean(),
        qualityFlags: z.array(SegmentQualityFlagSchema).max(6),
    }).strict()).min(1).max(100),
}).strict();

const GENERATED_EDIT_PLAN_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['segments'],
    properties: {
        segments: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
                type: 'object',
                additionalProperties: false,
                required: [
                    'classification', 'proxyStartUs', 'proxyEndUs', 'transcriptText',
                    'confidence', 'isBestTake', 'qualityFlags',
                ],
                properties: {
                    classification: {
                        type: 'string',
                        enum: ['performance', 'spoken', 'candid', 'failed_take', 'setup', 'unknown'],
                    },
                    proxyStartUs: { type: 'integer', minimum: 0 },
                    proxyEndUs: { type: 'integer', minimum: 1 },
                    transcriptText: { type: 'string', maxLength: 20_000 },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    takeIndex: { type: 'integer', minimum: 0 },
                    isBestTake: { type: 'boolean' },
                    qualityFlags: {
                        type: 'array',
                        maxItems: 6,
                        items: {
                            type: 'string',
                            enum: ['clipping', 'noise', 'reverb', 'low_volume', 'wind', 'overlapping_speech'],
                        },
                    },
                },
            },
        },
    },
} as const;

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
        proxy: {
            bucket: string;
            path: string;
            mimeType: string;
        };
        timeMap: PresentationTimeMap;
    }): Promise<SessionEditPlan>;
}

function mapProxyTimeToOriginal(proxyUs: number, timeMap: PresentationTimeMap): number {
    const finalIndex = timeMap.segments.length - 1;
    const mapping = timeMap.segments.find((segment, index) => (
        proxyUs >= segment.proxyStartUs
        && (proxyUs < segment.proxyEndUs || (index === finalIndex && proxyUs === segment.proxyEndUs))
    ));
    if (!mapping) {
        throw new HttpsError('internal', 'The generated edit plan falls outside the proxy time map.');
    }
    const proxySpan = mapping.proxyEndUs - mapping.proxyStartUs;
    const originalSpan = mapping.originalEndUs - mapping.originalStartUs;
    const offsetRatio = (proxyUs - mapping.proxyStartUs) / proxySpan;
    return Math.round(mapping.originalStartUs + (offsetRatio * originalSpan));
}

export function createDefaultEditPlanGenerator(models: Pick<Models, 'generateContent'> = getVertexAIClient().models): EditPlanGenerator {
    return {
        async generate(input) {
            const now = new Date().toISOString();
            const planId = `plan-${createHash('sha256').update(`${input.sessionId}:${input.sourceGeneration}:${now}`).digest('hex').slice(0, 16)}`;
            const receiptId = `receipt-plan-${createHash('sha256').update(`${planId}:${now}`).digest('hex').slice(0, 16)}`;
            const modelId = FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO;
            const response = await models.generateContent({
                model: modelId,
                contents: [{
                    role: 'user',
                    parts: [
                        {
                            text: [
                                'Analyze this private editing proxy and return a non-destructive edit plan.',
                                `The proxy duration is exactly ${input.durationUs} microseconds.`,
                                'Return useful, ordered, non-overlapping segments within [0, duration].',
                                'Classify performances, spoken material, candid moments, failed takes, setup, or unknown material.',
                                'Use transcriptText for verbatim audible speech; when no speech is audible, prefix a concise visual description with "[Visual]".',
                                'Mark the strongest usable take(s), assign evidence-based confidence, and report only observed quality flags.',
                                'Do not invent dialogue, timestamps, confidence, or media events.',
                            ].join('\n'),
                        },
                        {
                            fileData: {
                                mimeType: input.proxy.mimeType,
                                fileUri: `gs://${input.proxy.bucket}/${input.proxy.path}`,
                            },
                        },
                    ],
                }],
                config: {
                    responseMimeType: 'application/json',
                    responseJsonSchema: GENERATED_EDIT_PLAN_JSON_SCHEMA,
                    temperature: 0.2,
                    maxOutputTokens: 8192,
                },
            });
            if (!response.text) {
                throw new HttpsError('internal', 'The edit-planning model returned no plan.');
            }

            let decoded: unknown;
            try {
                decoded = JSON.parse(response.text);
            } catch {
                throw new HttpsError('internal', 'The edit-planning model returned malformed JSON.');
            }
            const generated = GeneratedEditPlanSchema.safeParse(decoded);
            if (!generated.success) {
                throw new HttpsError('internal', 'The edit-planning model returned an invalid plan.');
            }

            let previousEndUs = -1;
            for (const segment of generated.data.segments) {
                if (
                    segment.proxyEndUs <= segment.proxyStartUs
                    || segment.proxyEndUs > input.durationUs
                    || segment.proxyStartUs < previousEndUs
                ) {
                    throw new HttpsError('internal', 'The edit-planning model returned invalid segment timing.');
                }
                previousEndUs = segment.proxyEndUs;
            }

            const plan: SessionEditPlan = {
                schemaVersion: 'session-edit-plan.v1',
                planId,
                sessionId: input.sessionId,
                ownerUid: input.ownerUid,
                organizationId: input.organizationId,
                projectId: input.projectId,
                sourceGeneration: input.sourceGeneration,
                segments: generated.data.segments.map((segment, index) => ({
                    ...segment,
                    segmentId: `seg-${index + 1}`,
                    originalStartUs: mapProxyTimeToOriginal(segment.proxyStartUs, input.timeMap),
                    originalEndUs: mapProxyTimeToOriginal(segment.proxyEndUs, input.timeMap),
                    words: [],
                    syncAlignmentId: input.syncAlignmentId,
                })),
                modelProvenance: {
                    provider: 'vertex_ai',
                    modelId: response.modelVersion || modelId,
                    promptTokens: response.usageMetadata?.promptTokenCount,
                    completionTokens: response.usageMetadata?.candidatesTokenCount,
                },
                createdAt: now,
                receiptId,
            };

            return SessionEditPlanSchema.parse(plan);
        },
    };
}

export function createGenerateSessionEditPlanHandler(
    db: FirebaseFirestore.Firestore = getFirestore(),
    generator?: EditPlanGenerator,
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

        const plan = await (generator ?? createDefaultEditPlanGenerator()).generate({
            sessionId,
            ownerUid: authUid,
            organizationId: session.organizationId,
            projectId: session.projectId,
            sourceGeneration: session.original.generation,
            durationUs: session.proxyManifest.inspection.proxyDurationUs,
            syncAlignmentId: latestAlignment?.alignmentId,
            proxy: {
                bucket: session.proxyManifest.proxy.bucket,
                path: session.proxyManifest.proxy.path,
                mimeType: session.proxyManifest.proxy.mimeType,
            },
            timeMap: session.proxyManifest.timeMap,
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
