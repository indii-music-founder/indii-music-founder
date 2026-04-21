/**
 * milestone_execution.ts
 *
 * Inngest function for autonomous server-side milestone execution.
 * When `pollTimelineMilestones` finds a due milestone, it sends a
 * `timeline/milestone.due` event. This function picks it up and:
 *
 * 1. Marks the milestone as `executing` in Firestore
 * 2. Calls Gemini server-side to generate the agent's response
 * 3. Stores the result back on the milestone doc
 * 4. Marks the milestone as `completed` (or `failed` with retry info)
 *
 * Pattern: Same step.run() / step.sleep() pattern as video_generation.ts
 */

import { Inngest } from "inngest";
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { FUNCTION_AI_MODELS } from '../config/models';
import { getGeminiApiKey } from '../config/secrets';

const getDb = () => admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface TimelineMilestone {
    id: string;
    phaseId: string;
    phaseName: string;
    scheduledAt: number;
    type: string;
    instruction: string;
    assetStrategy: string;
    status: string;
    agentId: string;
    platform?: string;
    result?: string;
    error?: string;
    executedAt?: number;
    completedAt?: number;
    retryCount?: number;
}

interface TimelineDocument {
    milestones: TimelineMilestone[];
    status: string;
    completedCount: number;
    updatedAt: number | admin.firestore.FieldValue;
    title: string;
    goal: string;
    domain: string;
}

interface MilestoneEventData {
    userId: string;
    timelineId: string;
    milestoneId: string;
    agentId: string;
    instruction: string;
    assetStrategy: string;
    phaseName: string;
    type: string;
    platform: string | null;
    goal: string;
    title: string;
    domain: string;
}

// ============================================================================
// Agent Persona Mapping
// ============================================================================

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
    brand: `You are a brand manager. Ensure the content aligns with the provided brand strategy, tone of voice, and visual guidelines.`,
    marketing: `You are a music marketing specialist. Draft campaign copy, ad headlines, promotional captions, and audience targeting strategies.`,
    social: `You are a social media manager. Create engaging posts for TikTok, Instagram, and Twitter. Focus on community engagement and viral hooks.`,
    finance: `You are a financial analyst for music artists. Review royalty statements, calculate budget breakdowns, and analyze revenue trends.`,
    legal: `You are a legal advisor specializing in entertainment law. Review split sheets, draft terms of service, and handle sample clearance documentation.`,
    publishing: `You are a publishing administrator. Register songs with PROs, track mechanical royalties, and manage composition metadata.`,
    licensing: `You are a licensing specialist. Identify sync opportunities, negotiate usage rights, and manage mechanical licenses for samples.`,
    publicist: `You are a music publicist. Draft press releases, media pitches, interview talking points, and PR strategies for artist campaigns.`,
    music: `You are an audio intelligence agent. Provide sonic analysis, mix feedback, genre classification, and loudness optimization reports.`,
    road: `You are a tour/road manager. Handle venue coordination, logistics, travel planning, and promotional activities for live events.`,
    video: `You are a video producer for independent artists. Create shot lists, visual concepts, storyboard descriptions, and video content strategies.`,
    creative: `You are a creative director. Generate visual concepts, mood board descriptions, art direction notes, and design briefs for campaign assets.`,
};

function getSystemPromptForAgent(agentId: string): string {
    // Normalize agent ID (strip suffixes like -agent, _agent, etc. and handle legacy aliases)
    const normalized = agentId.toLowerCase()
        .replace(/[-_]agent$/, '')
        .replace('creative-director', 'creative')
        .replace('road-manager', 'road');
        
    return AGENT_SYSTEM_PROMPTS[normalized] ??
        `You are a specialist agent handling creative campaign milestones. Execute the given task precisely and output actionable, ready-to-use content.`;
}

// ============================================================================
// Inngest Function
// ============================================================================

// Using MilestoneEventData for the Inngest event payload

export const executeMilestoneFn = (inngestClient: Inngest) =>
    inngestClient.createFunction(
        {
            id: 'execute-timeline-milestone',
            retries: 2,
            concurrency: {
                limit: 5, // Max 5 concurrent milestone executions
            },
        },
        { event: 'timeline/milestone.due' },
        async ({ event, step }) => {
            const data = event.data as MilestoneEventData;
            const {
                userId,
                timelineId,
                milestoneId,
                agentId,
                instruction,
                assetStrategy,
                phaseName,
                type,
                platform,
                goal,
                title,
                domain,
            } = data;

            console.log(
                `[MilestoneExecution] Starting milestone="${milestoneId}" ` +
                `timeline="${title}" phase="${phaseName}" agent="${agentId}"`
            );

            try {
                // --------------------------------------------------------
                // Step 1: Mark milestone as executing in Firestore
                // --------------------------------------------------------
                await step.run('mark-executing', async () => {
                    const timelineRef = getDb()
                        .collection('timelines')
                        .doc(userId)
                        .collection('items')
                        .doc(timelineId);

                    await getDb().runTransaction(async (transaction) => {
                        const snap = await transaction.get(timelineRef);
                        if (!snap.exists) {
                            throw new Error(`Timeline ${timelineId} not found for user ${userId}`);
                        }

                        const timeline = snap.data() as TimelineDocument;
                        const milestones = timeline.milestones || [];
                        const idx = milestones.findIndex((m) => m.id === milestoneId);

                        if (idx === -1) {
                            throw new Error(`Milestone ${milestoneId} not found in timeline ${timelineId}`);
                        }

                        milestones[idx].status = 'executing';
                        milestones[idx].executedAt = Date.now();

                        transaction.update(timelineRef, {
                            milestones,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    });

                    console.log(`[MilestoneExecution] Marked milestone ${milestoneId} as executing`);
                });

                // --------------------------------------------------------
                // Step 2: Build prompt and call Gemini
                // --------------------------------------------------------
                const agentResult = await step.run('call-gemini-agent', async () => {
                    const apiKey = getGeminiApiKey();
                    const client = new GoogleGenAI({ apiKey });

                    const systemPrompt = getSystemPromptForAgent(agentId);

                    const taskPrompt = [
                        `[Timeline Orchestrator — Autonomous Milestone Execution]`,
                        ``,
                        `Campaign: ${title}`,
                        `Goal: ${goal}`,
                        `Domain: ${domain}`,
                        `Current Phase: ${phaseName}`,
                        `Milestone Type: ${type}`,
                        `Platform: ${platform ?? 'General'}`,
                        `Asset Strategy: ${assetStrategy}`,
                        ``,
                        `--- TASK ---`,
                        instruction,
                        ``,
                        `--- REQUIREMENTS ---`,
                        `- Output COMPLETE, ready-to-publish content.`,
                        `- If the milestone type is "post", provide the full caption/copy.`,
                        `- If the milestone type is "asset_creation", provide detailed asset descriptions and specifications.`,
                        `- If the milestone type is "agent_task", provide the full deliverable.`,
                        `- If the milestone type is "notification", provide the notification message.`,
                        `- Include platform-specific formatting (hashtags, character limits, etc.).`,
                        assetStrategy === 'create_new'
                            ? `- Generate fresh, original content — do not reference previous assets.`
                            : assetStrategy === 'use_existing'
                                ? `- Reference and build upon existing brand assets and previous campaign content.`
                                : `- Use your judgment on whether to create new content or reference existing assets.`,
                    ].join('\n');

                    const response = await client.models.generateContent({
                        model: FUNCTION_AI_MODELS.TEXT.FAST,
                        contents: taskPrompt,
                        config: {
                            systemInstruction: systemPrompt,
                            temperature: 1.0,
                            maxOutputTokens: 2048,
                        },
                    });

                    const text = response.text ?? '';
                    if (!text || text.trim().length === 0) {
                        throw new Error('Gemini returned empty response');
                    }

                    console.log(
                        `[MilestoneExecution] Gemini response for ${milestoneId}: ${text.slice(0, 200)}...`
                    );

                    return { text, generatedAt: Date.now() };
                });

                // --------------------------------------------------------
                // Step 3: Store result and mark completed
                // --------------------------------------------------------
                await step.run('mark-completed', async () => {
                    const timelineRef = getDb()
                        .collection('timelines')
                        .doc(userId)
                        .collection('items')
                        .doc(timelineId);

                    let completedCount = 0;
                    let totalMilestones = 0;

                    await getDb().runTransaction(async (transaction) => {
                        const snap = await transaction.get(timelineRef);
                        if (!snap.exists) {
                            throw new Error(`Timeline ${timelineId} not found`);
                        }

                        const timeline = snap.data() as TimelineDocument;
                        const milestones = timeline.milestones || [];
                        const idx = milestones.findIndex((m) => m.id === milestoneId);

                        if (idx === -1) {
                            throw new Error(`Milestone ${milestoneId} not found`);
                        }

                        milestones[idx].status = 'completed';
                        milestones[idx].result = agentResult.text;
                        milestones[idx].completedAt = agentResult.generatedAt;

                        // Update completion count
                        completedCount = milestones.filter(
                            (m) => m.status === 'completed'
                        ).length;
                        totalMilestones = milestones.length;

                        // Check if all milestones are finished
                        const allDone = milestones.every(
                            (m) =>
                                m.status === 'completed' ||
                                m.status === 'skipped' ||
                                m.status === 'failed'
                        );

                        const updates: Partial<TimelineDocument> & { updatedAt: admin.firestore.FieldValue } = {
                            milestones,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            completedCount,
                        };

                        if (allDone) {
                            updates.status = 'completed';
                            console.log(`[MilestoneExecution] Timeline "${title}" is now fully completed!`);
                        }

                        transaction.update(timelineRef, updates);
                    });

                    console.log(
                        `[MilestoneExecution] Milestone ${milestoneId} completed. ` +
                        `Progress: ${completedCount}/${totalMilestones}`
                    );
                });

                // --------------------------------------------------------
                // Step 4: Store execution record for audit trail
                // --------------------------------------------------------
                await step.run('write-audit-log', async () => {
                    await getDb().collection('timelineExecutionLogs').add({
                        userId,
                        timelineId,
                        milestoneId,
                        agentId,
                        phaseName,
                        type,
                        platform: platform ?? null,
                        instruction,
                        result: agentResult.text.slice(0, 5000), // Cap for storage
                        status: 'completed',
                        executedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });

                return {
                    success: true,
                    milestoneId,
                    resultPreview: agentResult.text.slice(0, 200),
                };
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(
                    `[MilestoneExecution] Error executing milestone ${milestoneId}:`,
                    error
                );

                // Mark the milestone as failed in Firestore
                await step.run('mark-failed', async () => {
                    try {
                        const timelineRef = getDb()
                            .collection('timelines')
                            .doc(userId)
                            .collection('items')
                            .doc(timelineId);

                        await getDb().runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
                            const snap = await transaction.get(timelineRef);
                            if (!snap.exists) return;

                            const timeline = snap.data() as TimelineDocument;
                            const milestones = timeline.milestones || [];
                            const idx = milestones.findIndex((m) => m.id === milestoneId);

                            if (idx !== -1) {
                                milestones[idx].status = 'failed';
                                milestones[idx].error = errorMessage || 'Unknown error';
                                milestones[idx].retryCount = (milestones[idx].retryCount || 0) + 1;

                                transaction.update(timelineRef, {
                                    milestones,
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                });
                            }
                        });

                        // Write failure to audit log (outside transaction — independent write)
                        await getDb().collection('timelineExecutionLogs').add({
                            userId,
                            timelineId,
                            milestoneId,
                            agentId,
                            phaseName,
                            type,
                            instruction,
                            error: errorMessage || 'Unknown error',
                            status: 'failed',
                            executedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    } catch (innerError) {
                        console.error(
                            `[MilestoneExecution] Failed to mark milestone as failed:`,
                            innerError
                        );
                    }
                });

                throw error; // Let Inngest retry
            }
        }
    );
