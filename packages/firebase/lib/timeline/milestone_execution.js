"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeMilestoneFn = void 0;
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
const models_1 = require("../config/models");
const secrets_1 = require("../config/secrets");
const getDb = () => admin.firestore();
// ============================================================================
// Agent Persona Mapping
// ============================================================================
const AGENT_SYSTEM_PROMPTS = {
    marketing: `You are an expert music marketing strategist. Execute the given marketing milestone precisely. Output actionable content — social captions, ad copy, email subjects, or asset descriptions. Be specific, creative, and on-brand. Always output ready-to-publish content.`,
    social: `You are a social media manager for an independent artist. Create platform-specific content optimized for engagement. Use relevant hashtags, hooks, and calls to action. Tailor tone and format for the specified platform.`,
    brand: `You are a brand strategist for independent artists. Create cohesive brand messaging, visual direction notes, and positioning statements. Ensure consistency across all touchpoints.`,
    distribution: `You are a music distribution specialist. Handle release logistics — metadata preparation, store optimization, playlist pitching descriptions, and delivery coordination.`,
    'road-manager': `You are a tour/road manager. Handle venue coordination, logistics, travel planning, and promotional activities for live events.`,
    publicist: `You are a music publicist. Draft press releases, media pitches, interview talking points, and PR strategies for artist campaigns.`,
    video: `You are a video producer for independent artists. Create shot lists, visual concepts, storyboard descriptions, and video content strategies.`,
    creative: `You are a creative director. Generate visual concepts, mood board descriptions, art direction notes, and design briefs for campaign assets.`,
};
function getSystemPromptForAgent(agentId) {
    var _a;
    // Normalize agent ID (strip suffixes like -agent, _agent, etc.)
    const normalized = agentId.toLowerCase().replace(/[-_]agent$/, '');
    return (_a = AGENT_SYSTEM_PROMPTS[normalized]) !== null && _a !== void 0 ? _a : `You are a specialist agent handling creative campaign milestones. Execute the given task precisely and output actionable, ready-to-use content.`;
}
// ============================================================================
// Inngest Function
// ============================================================================
const executeMilestoneFn = (inngestClient) => inngestClient.createFunction({
    id: 'execute-timeline-milestone',
    retries: 2,
    concurrency: {
        limit: 5, // Max 5 concurrent milestone executions
    },
}, { event: 'timeline/milestone.due' }, async ({ event, step }) => {
    const data = event.data;
    const { userId, timelineId, milestoneId, agentId, instruction, assetStrategy, phaseName, type, platform, goal, title, domain, } = data;
    console.log(`[MilestoneExecution] Starting milestone="${milestoneId}" ` +
        `timeline="${title}" phase="${phaseName}" agent="${agentId}"`);
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
                const timeline = snap.data();
                const milestones = timeline.milestones || [];
                const idx = milestones.findIndex((m) => m.id === milestoneId);
                if (idx === -1) {
                    throw new Error(`Milestone ${milestoneId} not found in timeline ${timelineId}`);
                }
                milestones[idx].status = 'executing';
                milestones[idx].executedAt = Date.now();
                transaction.update(timelineRef, {
                    milestones,
                    updatedAt: Date.now(),
                });
            });
            console.log(`[MilestoneExecution] Marked milestone ${milestoneId} as executing`);
        });
        // --------------------------------------------------------
        // Step 2: Build prompt and call Gemini
        // --------------------------------------------------------
        const agentResult = await step.run('call-gemini-agent', async () => {
            var _a;
            const apiKey = (0, secrets_1.getGeminiApiKey)();
            const client = new genai_1.GoogleGenAI({ apiKey });
            const systemPrompt = getSystemPromptForAgent(agentId);
            const taskPrompt = [
                `[Timeline Orchestrator — Autonomous Milestone Execution]`,
                ``,
                `Campaign: ${title}`,
                `Goal: ${goal}`,
                `Domain: ${domain}`,
                `Current Phase: ${phaseName}`,
                `Milestone Type: ${type}`,
                `Platform: ${platform !== null && platform !== void 0 ? platform : 'General'}`,
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
                model: models_1.FUNCTION_AI_MODELS.TEXT.FAST,
                contents: taskPrompt,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 1.0,
                    maxOutputTokens: 2048,
                },
            });
            const text = (_a = response.text) !== null && _a !== void 0 ? _a : '';
            if (!text || text.trim().length === 0) {
                throw new Error('Gemini returned empty response');
            }
            console.log(`[MilestoneExecution] Gemini response for ${milestoneId}: ${text.slice(0, 200)}...`);
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
                const timeline = snap.data();
                const milestones = timeline.milestones || [];
                const idx = milestones.findIndex((m) => m.id === milestoneId);
                if (idx === -1) {
                    throw new Error(`Milestone ${milestoneId} not found`);
                }
                milestones[idx].status = 'completed';
                milestones[idx].result = agentResult.text;
                milestones[idx].completedAt = agentResult.generatedAt;
                // Update completion count
                completedCount = milestones.filter((m) => m.status === 'completed').length;
                totalMilestones = milestones.length;
                // Check if all milestones are finished
                const allDone = milestones.every((m) => m.status === 'completed' ||
                    m.status === 'skipped' ||
                    m.status === 'failed');
                const updates = {
                    milestones,
                    updatedAt: Date.now(),
                    completedCount,
                };
                if (allDone) {
                    updates.status = 'completed';
                    console.log(`[MilestoneExecution] Timeline "${title}" is now fully completed!`);
                }
                transaction.update(timelineRef, updates);
            });
            console.log(`[MilestoneExecution] Milestone ${milestoneId} completed. ` +
                `Progress: ${completedCount}/${totalMilestones}`);
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
                platform: platform !== null && platform !== void 0 ? platform : null,
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
    }
    catch (error) {
        console.error(`[MilestoneExecution] Error executing milestone ${milestoneId}:`, error);
        // Mark the milestone as failed in Firestore
        await step.run('mark-failed', async () => {
            try {
                const timelineRef = getDb()
                    .collection('timelines')
                    .doc(userId)
                    .collection('items')
                    .doc(timelineId);
                await getDb().runTransaction(async (transaction) => {
                    const snap = await transaction.get(timelineRef);
                    if (!snap.exists)
                        return;
                    const timeline = snap.data();
                    const milestones = timeline.milestones || [];
                    const idx = milestones.findIndex((m) => m.id === milestoneId);
                    if (idx !== -1) {
                        milestones[idx].status = 'failed';
                        milestones[idx].error = error.message || 'Unknown error';
                        milestones[idx].retryCount = (milestones[idx].retryCount || 0) + 1;
                        transaction.update(timelineRef, {
                            milestones,
                            updatedAt: Date.now(),
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
                    error: error.message || 'Unknown error',
                    status: 'failed',
                    executedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch (innerError) {
                console.error(`[MilestoneExecution] Failed to mark milestone as failed:`, innerError);
            }
        });
        throw error; // Let Inngest retry
    }
});
exports.executeMilestoneFn = executeMilestoneFn;
//# sourceMappingURL=milestone_execution.js.map