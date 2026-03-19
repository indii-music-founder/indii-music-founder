/**
 * TimelineTools.ts
 *
 * Agent tool declarations for the Timeline Orchestrator.
 * These tools are available to ALL agents via SuperpowerTools,
 * enabling any specialist to create and manage progressive campaigns.
 *
 * Tools:
 * - create_timeline       — Generate a progressive timeline from a brief
 * - list_timelines        — Show the user's timelines
 * - get_timeline_status   — Detailed progress of a specific timeline
 * - activate_timeline     — Start a draft timeline
 * - pause_timeline        — Pause an active timeline
 * - resume_timeline       — Resume a paused timeline
 * - advance_phase         — Skip to the next phase
 * - adjust_cadence        — Change posting frequency mid-campaign
 * - list_templates        — Show available timeline templates
 */

import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { timelineOrchestrator } from '@/services/timeline/TimelineOrchestratorService';
import { logger } from '@/utils/logger';
import type { AnyToolFunction } from '../types';
import type { TimelineBrief, PhaseCadence } from '@/services/timeline/TimelineTypes';

// ============================================================================
// Tool Implementations
// ============================================================================

export const TimelineTools = {
    create_timeline: wrapTool('create_timeline', async (args: {
        goal: string;
        domain: string;
        durationWeeks: number;
        startDate: string;
        templateId?: string;
        platforms?: string[];
        releaseId?: string;
        customInstructions?: string;
        assetStrategy?: string;
    }) => {
        if (!args.goal || !args.domain || !args.durationWeeks || !args.startDate) {
            return toolError('Missing required fields: goal, domain, durationWeeks, startDate', 'VALIDATION_ERROR');
        }

        try {
            const brief: TimelineBrief = {
                goal: args.goal,
                domain: args.domain as TimelineBrief['domain'],
                durationWeeks: args.durationWeeks,
                startDate: args.startDate,
                templateId: args.templateId as TimelineBrief['templateId'] ?? 'custom',
                platforms: args.platforms,
                releaseId: args.releaseId,
                customInstructions: args.customInstructions,
                assetStrategy: (args.assetStrategy as TimelineBrief['assetStrategy']) ?? 'auto',
            };

            const timeline = await timelineOrchestrator.createTimeline(brief);
            const progress = timelineOrchestrator.getTimelineProgress(timeline);

            return toolSuccess({
                id: timeline.id,
                title: timeline.title,
                status: timeline.status,
                phases: timeline.phases.map(p => ({
                    name: p.name,
                    cadence: p.cadence,
                    startDay: p.startDay,
                    endDay: p.endDay,
                    agent: p.agentId,
                })),
                totalMilestones: timeline.milestones.length,
                startDate: new Date(timeline.startDate).toISOString(),
                endDate: new Date(timeline.endDate).toISOString(),
                progress,
            }, `Progressive timeline "${timeline.title}" created with ${timeline.phases.length} phases and ${timeline.milestones.length} milestones over ${args.durationWeeks} weeks. Status: DRAFT — use activate_timeline to start it.`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[TimelineTools] create_timeline failed:', msg);
            return toolError(`Failed to create timeline: ${msg}`, 'CREATION_FAILED');
        }
    }),

    list_timelines: wrapTool('list_timelines', async (_args: { status?: string }) => {
        try {
            const timelines = await timelineOrchestrator.getAllTimelines();

            if (timelines.length === 0) {
                return toolSuccess({ timelines: [] }, 'No timelines found. Use create_timeline to start a progressive campaign.');
            }

            const summaries = timelines.map(t => {
                const progress = timelineOrchestrator.getTimelineProgress(t);
                return {
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    currentPhase: progress.currentPhaseName,
                    percentComplete: progress.percentComplete,
                    daysRemaining: progress.daysRemaining,
                    totalMilestones: progress.totalMilestones,
                    completedMilestones: progress.completedMilestones,
                };
            });

            return toolSuccess({ timelines: summaries }, `Found ${summaries.length} timeline(s).`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to list timelines: ${msg}`, 'QUERY_FAILED');
        }
    }),

    get_timeline_status: wrapTool('get_timeline_status', async (args: { timelineId: string }) => {
        if (!args.timelineId) {
            return toolError('Missing required field: timelineId', 'VALIDATION_ERROR');
        }

        try {
            const timeline = await timelineOrchestrator.getTimeline(args.timelineId);
            if (!timeline) {
                return toolError(`Timeline not found: ${args.timelineId}`, 'NOT_FOUND');
            }

            const progress = timelineOrchestrator.getTimelineProgress(timeline);

            return toolSuccess({
                ...progress,
                phases: timeline.phases.map(p => ({
                    name: p.name,
                    cadence: p.cadence,
                    startDay: p.startDay,
                    endDay: p.endDay,
                    agent: p.agentId,
                    description: p.description,
                })),
                recentMilestones: timeline.milestones
                    .filter(m => m.status === 'completed')
                    .slice(-5)
                    .map(m => ({
                        instruction: m.instruction,
                        status: m.status,
                        executedAt: m.executedAt ? new Date(m.executedAt).toISOString() : null,
                        result: m.result,
                    })),
                upcomingMilestones: timeline.milestones
                    .filter(m => m.status === 'pending')
                    .slice(0, 5)
                    .map(m => ({
                        id: m.id,
                        instruction: m.instruction,
                        type: m.type,
                        scheduledAt: new Date(m.scheduledAt).toISOString(),
                        platform: m.platform,
                    })),
            }, `Timeline "${timeline.title}": ${progress.percentComplete}% complete. Phase: "${progress.currentPhaseName}". ${progress.daysRemaining} days remaining.`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to get timeline status: ${msg}`, 'QUERY_FAILED');
        }
    }),

    activate_timeline: wrapTool('activate_timeline', async (args: { timelineId: string }) => {
        if (!args.timelineId) {
            return toolError('Missing required field: timelineId', 'VALIDATION_ERROR');
        }

        try {
            const timeline = await timelineOrchestrator.activateTimeline(args.timelineId);
            return toolSuccess(
                { id: timeline.id, status: timeline.status },
                `Timeline "${timeline.title}" is now ACTIVE. Milestones will fire automatically on schedule.`,
            );
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to activate timeline: ${msg}`, 'UPDATE_FAILED');
        }
    }),

    pause_timeline: wrapTool('pause_timeline', async (args: { timelineId: string }) => {
        if (!args.timelineId) {
            return toolError('Missing required field: timelineId', 'VALIDATION_ERROR');
        }

        try {
            const timeline = await timelineOrchestrator.pauseTimeline(args.timelineId);
            return toolSuccess(
                { id: timeline.id, status: timeline.status },
                `Timeline "${timeline.title}" is now PAUSED. No milestones will fire until resumed.`,
            );
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to pause timeline: ${msg}`, 'UPDATE_FAILED');
        }
    }),

    resume_timeline: wrapTool('resume_timeline', async (args: { timelineId: string }) => {
        if (!args.timelineId) {
            return toolError('Missing required field: timelineId', 'VALIDATION_ERROR');
        }

        try {
            const timeline = await timelineOrchestrator.resumeTimeline(args.timelineId);
            return toolSuccess(
                { id: timeline.id, status: timeline.status },
                `Timeline "${timeline.title}" has been RESUMED and is now active again.`,
            );
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to resume timeline: ${msg}`, 'UPDATE_FAILED');
        }
    }),

    advance_phase: wrapTool('advance_phase', async (args: { timelineId: string }) => {
        if (!args.timelineId) {
            return toolError('Missing required field: timelineId', 'VALIDATION_ERROR');
        }

        try {
            const timeline = await timelineOrchestrator.advancePhase(args.timelineId);
            const progress = timelineOrchestrator.getTimelineProgress(timeline);

            return toolSuccess(
                {
                    id: timeline.id,
                    status: timeline.status,
                    currentPhase: progress.currentPhaseName,
                    percentComplete: progress.percentComplete,
                },
                timeline.status === 'completed'
                    ? `Timeline "${timeline.title}" has been completed! All phases finished.`
                    : `Advanced to phase "${progress.currentPhaseName}". Remaining pending milestones in the previous phase were skipped.`,
            );
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to advance phase: ${msg}`, 'UPDATE_FAILED');
        }
    }),

    adjust_cadence: wrapTool('adjust_cadence', async (args: { timelineId: string; phaseId: string; cadence: string }) => {
        if (!args.timelineId || !args.phaseId || !args.cadence) {
            return toolError('Missing required fields: timelineId, phaseId, cadence', 'VALIDATION_ERROR');
        }

        const validCadences: PhaseCadence[] = ['sparse', 'moderate', 'intense', 'daily'];
        if (!validCadences.includes(args.cadence as PhaseCadence)) {
            return toolError(`Invalid cadence: "${args.cadence}". Must be one of: ${validCadences.join(', ')}`, 'VALIDATION_ERROR');
        }

        try {
            const timeline = await timelineOrchestrator.adjustCadence(
                args.timelineId,
                args.phaseId,
                args.cadence as PhaseCadence,
            );

            const phase = timeline.phases.find(p => p.id === args.phaseId);
            return toolSuccess(
                { id: timeline.id, phaseId: args.phaseId, newCadence: args.cadence },
                `Phase "${phase?.name ?? args.phaseId}" cadence changed to "${args.cadence}".`,
            );
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to adjust cadence: ${msg}`, 'UPDATE_FAILED');
        }
    }),

    list_timeline_templates: wrapTool('list_timeline_templates', async () => {
        const templates = timelineOrchestrator.getAvailableTemplates();

        return toolSuccess(
            { templates },
            `Available templates:\n${templates.map(t => `• **${t.name}** (${t.recommendedWeeks} weeks): ${t.description}`).join('\n')}`,
        );
    }),
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const {
    create_timeline,
    list_timelines,
    get_timeline_status,
    activate_timeline,
    pause_timeline,
    resume_timeline,
    advance_phase,
    adjust_cadence,
    list_timeline_templates,
} = TimelineTools;
