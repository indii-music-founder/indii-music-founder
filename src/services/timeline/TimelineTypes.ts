/**
 * TimelineTypes.ts
 *
 * Type definitions for the Timeline Orchestrator — a multi-month progressive
 * campaign engine that orchestrates escalating phases across any agent domain.
 *
 * The Timeline system manages long-running campaigns (weeks to months) with:
 * - Phased progression (tease → build → launch → sustain)
 * - Auto-escalating posting cadence
 * - Smart asset resolution (create new vs. use existing)
 * - Agent-agnostic milestone execution
 */

import type { ValidAgentId } from '@/services/agent/types';

// ============================================================================
// Enums
// ============================================================================

export type TimelineStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

export type MilestoneStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';

export type MilestoneType =
    | 'post'              // Schedule/publish a social post
    | 'asset_creation'    // Generate image, video, or copy
    | 'agent_task'        // Delegate a task to a specialist agent
    | 'notification'      // Notify the user of something important
    | 'review_checkpoint' // Pause and ask user for approval before continuing
    | 'email_blast'       // Send email campaign
    | 'pre_save_push'     // Push pre-save links
    | 'analytics_check';  // Pull engagement data and possibly adapt

export type PhaseCadence = 'sparse' | 'moderate' | 'intense' | 'daily';

export type AssetStrategy = 'create_new' | 'use_existing' | 'auto';

export type TimelineTemplateId =
    | 'single_release_8w'
    | 'album_rollout_16w'
    | 'merch_drop_4w'
    | 'tour_promo_12w'
    | 'indii_28_day_frontloaded'
    | 'indii_curator_playlist_builder'
    | 'custom';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A single phase within a timeline (e.g. "Tease", "Build Hype", "Launch Week").
 * Each phase defines a window of days relative to the timeline start,
 * a cadence level, and which agent handles the work.
 */
export interface TimelinePhase {
    id: string;
    name: string;
    order: number;
    startDay: number;          // relative to timeline start (day 0)
    endDay: number;            // relative to timeline start
    cadence: PhaseCadence;
    agentId: ValidAgentId;
    description: string;
    /** Optional: override the default asset strategy for this phase */
    assetStrategy?: AssetStrategy;
    /** Optional: additional context or instructions for the agent */
    phaseInstructions?: string;
}

/**
 * A single milestone — a scheduled action within a phase.
 * When `scheduledAt` arrives and status is `pending`, the system executes it.
 */
export interface TimelineMilestone {
    id: string;
    phaseId: string;
    phaseName: string;
    scheduledAt: number;       // UTC timestamp (ms)
    type: MilestoneType;
    instruction: string;       // What the agent should do
    assetStrategy: AssetStrategy;
    status: MilestoneStatus;
    agentId: ValidAgentId;
    /** Platform target for posts (e.g. 'Instagram', 'Twitter') */
    platform?: string;
    /** Result message after execution */
    result?: string;
    /** Error message if failed */
    error?: string;
    /** ID of the generated/retrieved asset */
    assetId?: string;
    /** Timestamp of execution */
    executedAt?: number;
    /** Number of retry attempts */
    retryCount?: number;
}

/**
 * The full Timeline document stored in Firestore.
 */
export interface Timeline {
    id: string;
    userId: string;
    title: string;
    goal: string;
    domain: ValidAgentId;       // Primary agent domain (e.g. 'marketing', 'road', 'merchandise')
    templateId: TimelineTemplateId;
    startDate: number;          // UTC timestamp (ms)
    endDate: number;            // UTC timestamp (ms)
    phases: TimelinePhase[];
    milestones: TimelineMilestone[];
    status: TimelineStatus;
    /** Currently active phase order number */
    currentPhaseOrder: number;
    /** Total milestones completed */
    completedCount: number;
    /** Total milestones */
    totalCount: number;
    /** Optional: the release/project this timeline is tied to */
    releaseId?: string;
    releaseName?: string;
    createdAt: number;
    updatedAt: number;
}

// ============================================================================
// Brief / Input Types
// ============================================================================

/**
 * Input brief for creating a new timeline.
 * The AI uses this to generate a full phased plan.
 */
export interface TimelineBrief {
    /** What is this timeline for? e.g. "My new single 'Midnight Sun' dropping March 28" */
    goal: string;
    /** Primary agent domain */
    domain: ValidAgentId;
    /** Duration in weeks */
    durationWeeks: number;
    /** Target start date (ISO string or timestamp) */
    startDate: string;
    /** Which platforms to target (for marketing timelines) */
    platforms?: string[];
    /** Preferred template to use */
    templateId?: TimelineTemplateId;
    /** Optional: release ID to tie this timeline to */
    releaseId?: string;
    /** Optional: custom instructions for AI generation */
    customInstructions?: string;
    /** Optional: initial asset strategy preference */
    assetStrategy?: AssetStrategy;
}

// ============================================================================
// Phase Template Types
// ============================================================================

/**
 * A reusable phase template definition (not tied to a specific timeline).
 */
export interface PhaseTemplate {
    name: string;
    relativeStartPercent: number;  // 0.0–1.0 of total duration
    relativeEndPercent: number;
    cadence: PhaseCadence;
    agentId: ValidAgentId;
    description: string;
    /** Milestone templates within this phase */
    milestoneTemplates: MilestoneTemplate[];
}

/**
 * A template for generating a milestone within a phase.
 */
export interface MilestoneTemplate {
    /** Position within the phase (0.0–1.0) */
    relativePosition: number;
    type: MilestoneType;
    instruction: string;
    assetStrategy: AssetStrategy;
    agentId?: ValidAgentId;    // Override phase agent
    platform?: string;
}

/**
 * A complete timeline template containing phase templates.
 */
export interface TimelineTemplate {
    id: TimelineTemplateId;
    name: string;
    description: string;
    /** Recommended duration in weeks */
    recommendedWeeks: number;
    phases: PhaseTemplate[];
    /** Which agent domains this template is designed for */
    domains: ValidAgentId[];
}

// ============================================================================
// Progress / Status Types
// ============================================================================

/**
 * Summary of timeline progress for the UI.
 */
export interface TimelineProgress {
    timelineId: string;
    title: string;
    status: TimelineStatus;
    currentPhaseName: string;
    currentPhaseOrder: number;
    totalPhases: number;
    completedMilestones: number;
    totalMilestones: number;
    percentComplete: number;
    nextMilestone?: {
        id: string;
        instruction: string;
        scheduledAt: number;
        type: MilestoneType;
    };
    daysRemaining: number;
    daysElapsed: number;
}

/**
 * Callback for reporting execution progress to the UI.
 */
export interface TimelineExecutionEvent {
    type: 'milestone_started' | 'milestone_completed' | 'milestone_failed' | 'phase_advanced' | 'timeline_completed';
    timelineId: string;
    milestoneId?: string;
    phaseName?: string;
    message: string;
    timestamp: number;
}
