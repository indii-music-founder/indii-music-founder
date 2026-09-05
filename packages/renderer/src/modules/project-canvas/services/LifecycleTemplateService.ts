/**
 * LifecycleTemplateService.ts
 *
 * Provides lifecycle-based spatial canvas templates for indii.music artists.
 *
 * 8 Canonical Lifecycle Stages:
 * 1. create   — Ideation, songwriting, stems, recording
 * 2. prepare  — Mixing, mastering, artwork, visual briefs
 * 3. register — Metadata, ISRC/UPC, split sheets, PRO registrations
 * 4. deliver  — DDEX packaging, DSP distribution
 * 5. release  — Launch campaign, social assets, smart links
 * 6. track    — Streaming analytics, playlists, radio tracking
 * 7. operate  — Fan CRM, merchandise, touring, royalty collections
 * 8. repeat   — Catalog optimization, fan insights, next album
 *
 * Architectural Guarantees:
 * 1. Stages are visual frames / organizational lanes only, NEVER executing workflows.
 * 2. Artists can start with the template, rearrange, remove, or start blank.
 * 3. Sequence edges between frames represent visual ordering only.
 */

import type { ProjectCanvasBlock, LifecycleStage } from '../types';

export const LIFECYCLE_STAGES: Record<LifecycleStage, { label: string; description: string; color: string }> = {
    create: {
        label: '1. Create',
        description: 'Songwriting, stem capture, scratch demos, and collaborative sessions.',
        color: '#a855f7', // purple-500
    },
    prepare: {
        label: '2. Prepare',
        description: 'Post-mastering processing, visual design briefs, cover artwork, and lyrics.',
        color: '#06b6d4', // cyan-500
    },
    register: {
        label: '3. Register',
        description: 'ISRC, UPC/EAN allocation, split sheets, PRO copyright, and publishing rights.',
        color: '#3b82f6', // blue-500
    },
    deliver: {
        label: '4. Deliver',
        description: 'DDEX ERN 4.3 packaging, distributor SFTP delivery, DSP ingestion checks.',
        color: '#10b981', // emerald-500
    },
    release: {
        label: '5. Release',
        description: 'Launch day marketing, social video cutdowns, press pitches, and smart links.',
        color: '#f59e0b', // amber-500
    },
    track: {
        label: '6. Track',
        description: 'Spotify/Apple streaming analytics, radio airplay, playlist placements.',
        color: '#f97316', // orange-500
    },
    operate: {
        label: '7. Operate',
        description: 'Fan direct CRM, VIP merch campaigns, live touring dates, and royalty splits.',
        color: '#ec4899', // pink-500
    },
    repeat: {
        label: '8. Repeat',
        description: 'Catalog review, audience insights, and concept planning for the next release.',
        color: '#6366f1', // indigo-500
    },
};

export interface TemplateGenerationResult {
    blocks: Partial<Omit<ProjectCanvasBlock, 'id' | 'canvasId' | 'projectId' | 'createdAt' | 'updatedAt'>>[];
    edges: { sourceIndex: number; targetIndex: number; relationship: 'sequence'; label: string }[];
}

export class LifecycleTemplateService {
    /**
     * Generate the complete 8-stage lifecycle template arranged in sequential lanes.
     */
    static generateFullLifecycleTemplate(startX = 100, startY = 100): TemplateGenerationResult {
        const stages: LifecycleStage[] = [
            'create',
            'prepare',
            'register',
            'deliver',
            'release',
            'track',
            'operate',
            'repeat',
        ];

        const frameWidth = 360;
        const frameHeight = 520;
        const gapX = 60;

        const blocks = stages.map((stage, idx) => {
            const info = LIFECYCLE_STAGES[stage];
            return {
                type: 'frame' as const,
                position: {
                    x: startX + idx * (frameWidth + gapX),
                    y: startY,
                },
                size: {
                    width: frameWidth,
                    height: frameHeight,
                },
                zIndex: 0,
                snapshot: {
                    title: info.label,
                    excerpt: info.description,
                    cachedAt: Date.now(),
                },
                settings: {
                    stage,
                    color: info.color,
                    headerBackground: info.color,
                    customTitle: info.label,
                },
            };
        });

        // Generate non-executing sequence edges between adjacent stages
        const edges = stages.slice(0, -1).map((_, idx) => ({
            sourceIndex: idx,
            targetIndex: idx + 1,
            relationship: 'sequence' as const,
            label: 'Next Stage',
        }));

        return { blocks, edges };
    }

    /**
     * Generate a fast-track 4-stage single release template.
     */
    static generateSingleDropTemplate(startX = 100, startY = 100): TemplateGenerationResult {
        const stages: LifecycleStage[] = ['create', 'prepare', 'deliver', 'release'];
        const frameWidth = 380;
        const frameHeight = 540;
        const gapX = 80;

        const blocks = stages.map((stage, idx) => {
            const info = LIFECYCLE_STAGES[stage];
            return {
                type: 'frame' as const,
                position: {
                    x: startX + idx * (frameWidth + gapX),
                    y: startY,
                },
                size: {
                    width: frameWidth,
                    height: frameHeight,
                },
                zIndex: 0,
                snapshot: {
                    title: info.label,
                    excerpt: info.description,
                    cachedAt: Date.now(),
                },
                settings: {
                    stage,
                    color: info.color,
                    customTitle: info.label,
                },
            };
        });

        const edges = stages.slice(0, -1).map((_, idx) => ({
            sourceIndex: idx,
            targetIndex: idx + 1,
            relationship: 'sequence' as const,
            label: 'Next',
        }));

        return { blocks, edges };
    }
}
