/**
 * Onboarding Analytics Service
 *
 * Tracks user progress through the onboarding funnel to identify
 * drop-off points and optimize the experience.
 *
 * Events are sent to Firebase Analytics (via gtag) when available,
 * with a local fallback for development.
 */
import { Logger } from '@/core/logger/Logger';

type OnboardingPhase =
    | 'identity_intro'
    | 'identity_core'
    | 'identity_branding'
    | 'identity_visuals'
    | 'release_intro'
    | 'release_details'
    | 'release_assets'
    | 'complete';

interface OnboardingEvent {
    event: string;
    phase?: OnboardingPhase;
    field?: string;
    coreProgress?: number;
    releaseProgress?: number;
    durationMs?: number;
    [key: string]: unknown;
}

class OnboardingAnalytics {
    private startTime: number | null = null;
    private phaseTimestamps: Map<string, number> = new Map();

    /** Call when user enters the onboarding flow */
    start(): void {
        this.startTime = Date.now();
        this.track({ event: 'onboarding_started' });
    }

    /** Track phase transitions */
    phaseChange(from: OnboardingPhase, to: OnboardingPhase, coreProgress: number, releaseProgress: number): void {
        const now = Date.now();
        const phaseStart = this.phaseTimestamps.get(from) || this.startTime || now;
        const phaseDuration = now - phaseStart;
        this.phaseTimestamps.set(to, now);

        this.track({
            event: 'onboarding_phase_change',
            phase: to,
            from_phase: from,
            coreProgress,
            releaseProgress,
            durationMs: phaseDuration,
        });
    }

    /** Track individual field completions */
    fieldCompleted(field: string, phase: OnboardingPhase): void {
        this.track({
            event: 'onboarding_field_completed',
            field,
            phase,
        });
    }

    /** Track progress milestones (25%, 50%, 75%, 100%) */
    progressMilestone(milestone: number, layer: 'core' | 'release'): void {
        this.track({
            event: 'onboarding_progress_milestone',
            milestone,
            layer,
        });
    }

    /** Track distributor selection */
    distributorSelected(distributor: string): void {
        this.track({
            event: 'onboarding_distributor_selected',
            distributor,
        });
    }

    /** Track file uploads during onboarding */
    fileUploaded(fileType: string, category: string): void {
        this.track({
            event: 'onboarding_file_uploaded',
            fileType,
            category,
        });
    }

    /** Track when user skips onboarding early */
    skipped(coreProgress: number, releaseProgress: number, phase: OnboardingPhase): void {
        const duration = this.startTime ? Date.now() - this.startTime : 0;
        this.track({
            event: 'onboarding_skipped',
            phase,
            coreProgress,
            releaseProgress,
            durationMs: duration,
        });
    }

    /** Track onboarding completion */
    completed(coreProgress: number, releaseProgress: number, messageCount: number): void {
        const duration = this.startTime ? Date.now() - this.startTime : 0;
        this.track({
            event: 'onboarding_completed',
            coreProgress,
            releaseProgress,
            messageCount,
            durationMs: duration,
        });
        this.startTime = null;
        this.phaseTimestamps.clear();
    }

    /** Track errors during onboarding */
    error(errorType: string, phase: OnboardingPhase): void {
        this.track({
            event: 'onboarding_error',
            errorType,
            phase,
        });
    }

    private track(event: OnboardingEvent): void {
        Logger.info('OnboardingAnalytics', `${event.event}`, event);

        // Send to Firebase Analytics via gtag if available
        try {
            if (typeof window !== 'undefined' && 'gtag' in window) {
                (window as any).gtag('event', event.event, {
                    event_category: 'onboarding',
                    ...event,
                });
            }
        } catch {
            // Analytics not available — logged above via Logger
        }
    }
}

export const onboardingAnalytics = new OnboardingAnalytics();
