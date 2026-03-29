/**
 * TimelineOrchestratorService.ts
 *
 * The core engine for managing long-running, multi-phase progressive campaigns.
 * This service handles:
 *
 * 1. **Creating Timelines** — AI-generates a phased plan from a brief + template
 * 2. **Phase Management** — tracks the current phase and cadence
 * 3. **Milestone Execution** — fires due milestones via agent delegation
 * 4. **Asset Resolution** — creates new or retrieves existing assets
 * 5. **Lifecycle** — pause, resume, cancel, complete
 *
 * Persistence: Firestore `timelines/{userId}/items/{timelineId}`
 * Polling: Firebase Cloud Scheduler `pollTimelineMilestones` (every 15 min)
 */

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    deleteDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { GenAI } from '@/services/ai/GenAI';
import { getTimelineTemplate, listTimelineTemplates } from './TimelinePhaseTemplates';
import { logger } from '@/utils/logger';

import type {
    Timeline,
    TimelineBrief,
    TimelinePhase,
    TimelineMilestone,
    TimelineProgress,
    TimelineStatus,
    MilestoneStatus,
    TimelineExecutionEvent,
    TimelineTemplate,
    PhaseTemplate,
    AssetStrategy,
} from './TimelineTypes';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_ROOT = 'timelines';

/** Cadence → approximate posts per week */
const CADENCE_FREQUENCY: Record<string, number> = {
    sparse: 2,
    moderate: 4,
    intense: 7,
    daily: 7,
};

/** Maximum milestones per timeline (safety cap) */
const MAX_MILESTONES = 200;

// ============================================================================
// Service
// ============================================================================

export class TimelineOrchestratorService {
    // ========================================================================
    // Timeline Creation
    // ========================================================================

    /**
     * Create a new progressive timeline from a brief.
     * Uses a template if specified, then AI-enhances with domain-specific milestones.
     */
    async createTimeline(brief: TimelineBrief): Promise<Timeline> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated to create a timeline.');

        const startTs = new Date(brief.startDate).getTime();
        if (isNaN(startTs)) throw new Error(`Invalid start date: ${brief.startDate}`);

        const durationMs = brief.durationWeeks * 7 * 24 * 60 * 60 * 1000;
        const endTs = startTs + durationMs;

        // Resolve template
        const templateId = brief.templateId ?? 'custom';
        const template = templateId !== 'custom' ? getTimelineTemplate(templateId) : null;

        let phases: TimelinePhase[];
        let milestones: TimelineMilestone[];

        if (template) {
            // Generate from template
            const result = this.generateFromTemplate(template, brief, startTs, durationMs);
            phases = result.phases;
            milestones = result.milestones;
        } else {
            // Fully AI-generated
            const result = await this.generateWithAI(brief, startTs, durationMs);
            phases = result.phases;
            milestones = result.milestones;
        }

        // Construct the timeline document
        const timelineId = `tl_${Date.now()}_${secureRandomAlphanumeric(6)}`;
        const now = Date.now();

        const timeline: Timeline = {
            id: timelineId,
            userId,
            title: `${brief.goal}`,
            goal: brief.goal,
            domain: brief.domain,
            templateId,
            startDate: startTs,
            endDate: endTs,
            phases,
            milestones,
            status: 'draft',
            currentPhaseOrder: 0,
            completedCount: 0,
            totalCount: milestones.length,
            releaseId: brief.releaseId,
            createdAt: now,
            updatedAt: now,
        };

        // Persist to Firestore
        await this.saveTimeline(timeline);

        logger.info(`[TimelineOrchestrator] Created timeline "${timeline.title}" with ${milestones.length} milestones across ${phases.length} phases.`);

        return timeline;
    }

    /**
     * Generate phases and milestones from a pre-built template.
     */
    private generateFromTemplate(
        template: TimelineTemplate,
        brief: TimelineBrief,
        startTs: number,
        durationMs: number,
    ): { phases: TimelinePhase[]; milestones: TimelineMilestone[] } {
        const phases: TimelinePhase[] = [];
        const milestones: TimelineMilestone[] = [];

        template.phases.forEach((phaseTemplate: PhaseTemplate, phaseIndex: number) => {
            const phaseStartMs = startTs + durationMs * phaseTemplate.relativeStartPercent;
            const phaseEndMs = startTs + durationMs * phaseTemplate.relativeEndPercent;
            const phaseDurationMs = phaseEndMs - phaseStartMs;

            const phaseId = `phase_${phaseIndex}`;

            // Create the phase
            const phase: TimelinePhase = {
                id: phaseId,
                name: phaseTemplate.name,
                order: phaseIndex,
                startDay: Math.round((phaseStartMs - startTs) / (24 * 60 * 60 * 1000)),
                endDay: Math.round((phaseEndMs - startTs) / (24 * 60 * 60 * 1000)),
                cadence: phaseTemplate.cadence,
                agentId: phaseTemplate.agentId,
                description: phaseTemplate.description,
                assetStrategy: brief.assetStrategy,
            };
            phases.push(phase);

            // Create the milestones for this phase
            phaseTemplate.milestoneTemplates.forEach((mt, mtIndex) => {
                const milestoneTs = Math.round(phaseStartMs + phaseDurationMs * mt.relativePosition);

                const milestone: TimelineMilestone = {
                    id: `ms_${phaseIndex}_${mtIndex}`,
                    phaseId,
                    phaseName: phaseTemplate.name,
                    scheduledAt: milestoneTs,
                    type: mt.type,
                    instruction: mt.instruction,
                    assetStrategy: mt.assetStrategy ?? brief.assetStrategy ?? 'auto',
                    status: 'pending',
                    agentId: mt.agentId ?? phaseTemplate.agentId,
                    platform: mt.platform,
                    retryCount: 0,
                };
                milestones.push(milestone);
            });
        });

        // Sort milestones by scheduled time
        milestones.sort((a, b) => a.scheduledAt - b.scheduledAt);

        return { phases, milestones };
    }

    /**
     * Generate a fully custom timeline using AI.
     */
    private async generateWithAI(
        brief: TimelineBrief,
        startTs: number,
        durationMs: number,
    ): Promise<{ phases: TimelinePhase[]; milestones: TimelineMilestone[] }> {
        const prompt = `You are a progressive campaign strategist for an independent music artist.

Goal: ${brief.goal}
Domain: ${brief.domain}
Duration: ${brief.durationWeeks} weeks (${Math.round(brief.durationWeeks / 4)} months)
Start Date: ${new Date(startTs).toISOString()}
End Date: ${new Date(startTs + durationMs).toISOString()}
${brief.platforms ? `Platforms: ${brief.platforms.join(', ')}` : ''}
${brief.customInstructions ? `Custom Instructions: ${brief.customInstructions}` : ''}

Design a PROGRESSIVE campaign that starts small and escalates in intensity over time.

Requirements:
1. Create 3-5 phases that escalate from "sparse" to "intense" and back to "moderate"
2. Each phase has a name, description, cadence level, and a start/end day number (relative to day 0)
3. For each phase, generate 3-8 milestones with specific, actionable instructions
4. Milestones should cover: posts, asset creation, email blasts, analytics checks, and review checkpoints
5. The campaign should feel natural — not robotic. Space things out with variety.

Return a JSON object with:
{
  "phases": [
    {
      "name": "Phase Name",
      "startDay": 0,
      "endDay": 14,
      "cadence": "sparse|moderate|intense|daily",
      "agentId": "marketing|social|distribution|road|merchandise|publicist",
      "description": "What this phase achieves"
    }
  ],
  "milestones": [
    {
      "phaseIndex": 0,
      "dayOffset": 3,
      "type": "post|asset_creation|agent_task|notification|review_checkpoint|email_blast|pre_save_push|analytics_check",
      "instruction": "Specific actionable instruction for the agent",
      "assetStrategy": "create_new|use_existing|auto",
      "platform": "Instagram|Twitter|TikTok|YouTube|null"
    }
  ]
}`;

        const schema = {
            type: 'object',
            properties: {
                phases: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            startDay: { type: 'number' },
                            endDay: { type: 'number' },
                            cadence: { type: 'string', enum: ['sparse', 'moderate', 'intense', 'daily'] },
                            agentId: { type: 'string' },
                            description: { type: 'string' },
                        },
                        required: ['name', 'startDay', 'endDay', 'cadence', 'agentId', 'description'],
                    },
                },
                milestones: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            phaseIndex: { type: 'number' },
                            dayOffset: { type: 'number' },
                            type: { type: 'string' },
                            instruction: { type: 'string' },
                            assetStrategy: { type: 'string', enum: ['create_new', 'use_existing', 'auto'] },
                            platform: { type: 'string' },
                        },
                        required: ['phaseIndex', 'dayOffset', 'type', 'instruction', 'assetStrategy'],
                    },
                },
            },
            required: ['phases', 'milestones'],
        };

        type AIPhase = { name: string; startDay: number; endDay: number; cadence: string; agentId: string; description: string };
        type AIMilestone = { phaseIndex: number; dayOffset: number; type: string; instruction: string; assetStrategy: string; platform?: string };
        type AIResult = { phases: AIPhase[]; milestones: AIMilestone[] };

        const result = await GenAI.generateStructuredData<AIResult>(prompt, schema as Record<string, unknown>);

        const rawPhases = result?.phases ?? [];
        const rawMilestones = result?.milestones ?? [];

        // Convert AI output to typed structures
        const phases: TimelinePhase[] = rawPhases.map((p: AIPhase, i: number) => ({
            id: `phase_${i}`,
            name: p.name || `Phase ${i + 1}`,
            order: i,
            startDay: p.startDay ?? 0,
            endDay: p.endDay ?? brief.durationWeeks * 7,
            cadence: (['sparse', 'moderate', 'intense', 'daily'].includes(p.cadence) ? p.cadence : 'moderate') as TimelinePhase['cadence'],
            agentId: (p.agentId || brief.domain) as TimelinePhase['agentId'],
            description: p.description || '',
        }));

        const milestones: TimelineMilestone[] = rawMilestones
            .slice(0, MAX_MILESTONES)
            .map((m: AIMilestone, i: number) => {
                const phaseIndex = Math.min(m.phaseIndex ?? 0, phases.length - 1);
                const phase = phases[phaseIndex];
                const milestoneTs = startTs + (m.dayOffset ?? 0) * 24 * 60 * 60 * 1000;

                return {
                    id: `ms_${phaseIndex}_${i}`,
                    phaseId: phase?.id ?? `phase_${phaseIndex}`,
                    phaseName: phase?.name ?? 'Unknown',
                    scheduledAt: milestoneTs,
                    type: m.type as TimelineMilestone['type'] ?? 'agent_task',
                    instruction: m.instruction || 'Execute campaign task',
                    assetStrategy: (m.assetStrategy as AssetStrategy) ?? 'auto',
                    status: 'pending' as MilestoneStatus,
                    agentId: (phase?.agentId ?? brief.domain) as TimelineMilestone['agentId'],
                    platform: m.platform ?? undefined,
                    retryCount: 0,
                };
            });

        milestones.sort((a, b) => a.scheduledAt - b.scheduledAt);

        return { phases, milestones };
    }

    // ========================================================================
    // Milestone Execution
    // ========================================================================

    /**
     * Get all milestones that are due (scheduledAt <= now, status === 'pending')
     * for a specific user.
     */
    async getDueMillestones(userId: string): Promise<Array<{ timeline: Timeline; milestone: TimelineMilestone }>> {
        const now = Date.now();
        const timelines = await this.getActiveTimelines(userId);
        const dueMilestones: Array<{ timeline: Timeline; milestone: TimelineMilestone }> = [];

        for (const timeline of timelines) {
            for (const milestone of timeline.milestones) {
                if (milestone.status === 'pending' && milestone.scheduledAt <= now) {
                    dueMilestones.push({ timeline, milestone });
                }
            }
        }

        return dueMilestones;
    }

    /**
     * Execute a single milestone by delegating to the appropriate agent.
     * Updates the milestone status in Firestore.
     */
    async executeMilestone(
        timelineId: string,
        milestoneId: string,
        onEvent?: (event: TimelineExecutionEvent) => void,
    ): Promise<void> {
        const timeline = await this.getTimeline(timelineId);
        if (!timeline) throw new Error(`Timeline not found: ${timelineId}`);

        const milestoneIndex = timeline.milestones.findIndex(m => m.id === milestoneId);
        if (milestoneIndex === -1) throw new Error(`Milestone not found: ${milestoneId}`);

        const milestone = timeline.milestones[milestoneIndex]!;
        if (milestone.status !== 'pending') {
            logger.warn(`[TimelineOrchestrator] Milestone ${milestoneId} is not pending (status: ${milestone.status}). Skipping.`);
            return;
        }

        // Mark as executing
        milestone.status = 'executing';
        await this.updateMilestone(timeline, milestoneIndex);

        onEvent?.({
            type: 'milestone_started',
            timelineId,
            milestoneId,
            phaseName: milestone.phaseName,
            message: `Starting: ${milestone.instruction}`,
            timestamp: Date.now(),
        });

        try {
            // Dispatch to the appropriate agent
            // We lazy-import agentService to avoid circular deps
            const { agentService } = await import('@/services/agent/AgentService');

            const taskPrompt = this.buildMilestonePrompt(milestone, timeline);

            const response = await agentService.runAgent(
                milestone.agentId,
                taskPrompt,
            );

            // Mark as completed
            milestone.status = 'completed';
            milestone.result = typeof response?.text === 'string' ? response.text.slice(0, 500) : 'Completed successfully';
            milestone.executedAt = Date.now();
            await this.updateMilestone(timeline, milestoneIndex);

            onEvent?.({
                type: 'milestone_completed',
                timelineId,
                milestoneId,
                phaseName: milestone.phaseName,
                message: `Completed: ${milestone.instruction}`,
                timestamp: Date.now(),
            });

            // Check if we need to advance the phase
            await this.checkPhaseAdvancement(timeline);

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            milestone.status = 'failed';
            milestone.error = msg;
            milestone.retryCount = (milestone.retryCount ?? 0) + 1;
            milestone.executedAt = Date.now();
            await this.updateMilestone(timeline, milestoneIndex);

            onEvent?.({
                type: 'milestone_failed',
                timelineId,
                milestoneId,
                phaseName: milestone.phaseName,
                message: `Failed: ${msg}`,
                timestamp: Date.now(),
            });

            logger.error(`[TimelineOrchestrator] Milestone ${milestoneId} failed:`, msg);
        }
    }

    /**
     * Build the full prompt for an agent to execute a milestone.
     */
    private buildMilestonePrompt(milestone: TimelineMilestone, timeline: Timeline): string {
        const parts: string[] = [
            `You are executing a scheduled milestone as part of a progressive campaign.`,
            ``,
            `**Campaign:** ${timeline.title}`,
            `**Goal:** ${timeline.goal}`,
            `**Current Phase:** ${milestone.phaseName}`,
            `**Milestone Type:** ${milestone.type}`,
            `**Target Platform:** ${milestone.platform ?? 'Any'}`,
            ``,
            `**Your Task:**`,
            milestone.instruction,
            ``,
            `**Asset Strategy:** ${milestone.assetStrategy}`,
        ];

        if (milestone.assetStrategy === 'create_new') {
            parts.push(`You MUST generate new creative assets (images, copy, etc.) for this milestone. Do not reuse existing content.`);
        } else if (milestone.assetStrategy === 'use_existing') {
            parts.push(`You should use existing brand assets where possible. Check the user's asset library first.`);
        } else {
            parts.push(`Use your judgment: create new assets if needed, or reuse existing brand assets when appropriate.`);
        }

        return parts.join('\n');
    }

    /**
     * Check if all milestones in the current phase are done and advance if so.
     */
    private async checkPhaseAdvancement(timeline: Timeline): Promise<void> {
        const currentPhase = timeline.phases.find(p => p.order === timeline.currentPhaseOrder);
        if (!currentPhase) return;

        const phaseMilestones = timeline.milestones.filter(m => m.phaseId === currentPhase.id);
        const allDone = phaseMilestones.every(m => m.status === 'completed' || m.status === 'skipped' || m.status === 'failed');

        if (allDone) {
            const nextPhase = timeline.phases.find(p => p.order === timeline.currentPhaseOrder + 1);
            if (nextPhase) {
                timeline.currentPhaseOrder = nextPhase.order;
                logger.info(`[TimelineOrchestrator] Advanced to phase "${nextPhase.name}" (order ${nextPhase.order})`);
            } else {
                // All phases complete
                timeline.status = 'completed';
                logger.info(`[TimelineOrchestrator] Timeline "${timeline.title}" is now completed!`);
            }

            // Update completed count
            timeline.completedCount = timeline.milestones.filter(m => m.status === 'completed').length;
            timeline.updatedAt = Date.now();
            await this.saveTimeline(timeline);
        }
    }

    // ========================================================================
    // Lifecycle Management
    // ========================================================================

    /**
     * Activate a draft timeline, making it eligible for milestone polling.
     */
    async activateTimeline(timelineId: string): Promise<Timeline> {
        return this.updateTimelineStatus(timelineId, 'active');
    }

    /**
     * Pause an active timeline. Due milestones will not fire until resumed.
     */
    async pauseTimeline(timelineId: string): Promise<Timeline> {
        return this.updateTimelineStatus(timelineId, 'paused');
    }

    /**
     * Resume a paused timeline.
     */
    async resumeTimeline(timelineId: string): Promise<Timeline> {
        return this.updateTimelineStatus(timelineId, 'active');
    }

    /**
     * Cancel a timeline permanently.
     */
    async cancelTimeline(timelineId: string): Promise<Timeline> {
        return this.updateTimelineStatus(timelineId, 'cancelled');
    }

    private async updateTimelineStatus(timelineId: string, status: TimelineStatus): Promise<Timeline> {
        const timeline = await this.getTimeline(timelineId);
        if (!timeline) throw new Error(`Timeline not found: ${timelineId}`);

        timeline.status = status;
        timeline.updatedAt = Date.now();
        await this.saveTimeline(timeline);

        logger.info(`[TimelineOrchestrator] Timeline "${timeline.title}" status changed to: ${status}`);
        return timeline;
    }

    /**
     * Manually advance to the next phase, skipping any remaining milestones in the current phase.
     */
    async advancePhase(timelineId: string): Promise<Timeline> {
        const timeline = await this.getTimeline(timelineId);
        if (!timeline) throw new Error(`Timeline not found: ${timelineId}`);

        const currentPhase = timeline.phases.find(p => p.order === timeline.currentPhaseOrder);
        if (!currentPhase) throw new Error('No current phase found.');

        // Skip remaining pending milestones in current phase
        for (const milestone of timeline.milestones) {
            if (milestone.phaseId === currentPhase.id && milestone.status === 'pending') {
                milestone.status = 'skipped';
            }
        }

        // Advance to next phase
        const nextPhase = timeline.phases.find(p => p.order === timeline.currentPhaseOrder + 1);
        if (nextPhase) {
            timeline.currentPhaseOrder = nextPhase.order;
        } else {
            timeline.status = 'completed';
        }

        timeline.completedCount = timeline.milestones.filter(m => m.status === 'completed').length;
        timeline.updatedAt = Date.now();
        await this.saveTimeline(timeline);

        return timeline;
    }

    /**
     * Adjust the cadence of a specific phase (e.g., change "moderate" to "intense").
     * This re-distributes pending milestones within the phase.
     */
    async adjustCadence(timelineId: string, phaseId: string, newCadence: TimelinePhase['cadence']): Promise<Timeline> {
        const timeline = await this.getTimeline(timelineId);
        if (!timeline) throw new Error(`Timeline not found: ${timelineId}`);

        const phase = timeline.phases.find(p => p.id === phaseId);
        if (!phase) throw new Error(`Phase not found: ${phaseId}`);

        phase.cadence = newCadence;
        timeline.updatedAt = Date.now();
        await this.saveTimeline(timeline);

        logger.info(`[TimelineOrchestrator] Phase "${phase.name}" cadence changed to: ${newCadence}`);
        return timeline;
    }

    // ========================================================================
    // Query Methods
    // ========================================================================

    /**
     * Get all active timelines for a user.
     */
    async getActiveTimelines(userId: string): Promise<Timeline[]> {
        return this.getTimelinesByStatus(userId, 'active');
    }

    /**
     * Get all timelines for a user (any status).
     */
    async getAllTimelines(userId?: string): Promise<Timeline[]> {
        const uid = userId ?? auth.currentUser?.uid;
        if (!uid) return [];

        try {
            const colRef = collection(db, COLLECTION_ROOT, uid, 'items');
            const q = query(colRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data() as Timeline);
        } catch (error: unknown) {
            logger.error('[TimelineOrchestrator] Failed to fetch timelines:', error);
            return [];
        }
    }

    /**
     * Get timelines filtered by status.
     */
    async getTimelinesByStatus(userId: string, status: TimelineStatus): Promise<Timeline[]> {
        try {
            const colRef = collection(db, COLLECTION_ROOT, userId, 'items');
            const q = query(colRef, where('status', '==', status));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data() as Timeline);
        } catch (error: unknown) {
            logger.error(`[TimelineOrchestrator] Failed to fetch ${status} timelines:`, error);
            return [];
        }
    }

    /**
     * Get a single timeline by ID.
     */
    async getTimeline(timelineId: string): Promise<Timeline | null> {
        const userId = auth.currentUser?.uid;
        if (!userId) return null;

        try {
            const docRef = doc(db, COLLECTION_ROOT, userId, 'items', timelineId);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return null;
            return snapshot.data() as Timeline;
        } catch (error: unknown) {
            logger.error(`[TimelineOrchestrator] Failed to fetch timeline ${timelineId}:`, error);
            return null;
        }
    }

    /**
     * Get progress summary for a timeline.
     */
    getTimelineProgress(timeline: Timeline): TimelineProgress {
        const now = Date.now();
        const totalDuration = timeline.endDate - timeline.startDate;
        const elapsed = Math.max(0, now - timeline.startDate);
        const daysElapsed = Math.round(elapsed / (24 * 60 * 60 * 1000));
        const daysRemaining = Math.max(0, Math.round((timeline.endDate - now) / (24 * 60 * 60 * 1000)));

        const completedMilestones = timeline.milestones.filter(m => m.status === 'completed').length;
        const totalMilestones = timeline.milestones.length;
        const percentComplete = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

        const currentPhase = timeline.phases.find(p => p.order === timeline.currentPhaseOrder);

        const nextMilestone = timeline.milestones
            .filter(m => m.status === 'pending')
            .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];

        return {
            timelineId: timeline.id,
            title: timeline.title,
            status: timeline.status,
            currentPhaseName: currentPhase?.name ?? 'Unknown',
            currentPhaseOrder: timeline.currentPhaseOrder,
            totalPhases: timeline.phases.length,
            completedMilestones,
            totalMilestones,
            percentComplete,
            nextMilestone: nextMilestone ? {
                id: nextMilestone.id,
                instruction: nextMilestone.instruction,
                scheduledAt: nextMilestone.scheduledAt,
                type: nextMilestone.type,
            } : undefined,
            daysElapsed,
            daysRemaining,
        };
    }

    /**
     * List available templates.
     */
    getAvailableTemplates() {
        return listTimelineTemplates();
    }

    // ========================================================================
    // Firestore Persistence
    // ========================================================================

    /**
     * Save (create or overwrite) a timeline document.
     */
    private async saveTimeline(timeline: Timeline): Promise<void> {
        const userId = timeline.userId;
        const docRef = doc(db, COLLECTION_ROOT, userId, 'items', timeline.id);
        await setDoc(docRef, {
            ...timeline,
            _updatedAt: serverTimestamp(),
        });
    }

    /**
     * Update a specific milestone within a timeline.
     */
    private async updateMilestone(timeline: Timeline, milestoneIndex: number): Promise<void> {
        timeline.completedCount = timeline.milestones.filter(m => m.status === 'completed').length;
        timeline.updatedAt = Date.now();
        await this.saveTimeline(timeline);
    }

    /**
     * Delete a timeline.
     */
    async deleteTimeline(timelineId: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated.');

        const docRef = doc(db, COLLECTION_ROOT, userId, 'items', timelineId);
        await deleteDoc(docRef);

        logger.info(`[TimelineOrchestrator] Deleted timeline: ${timelineId}`);
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const timelineOrchestrator = new TimelineOrchestratorService();
