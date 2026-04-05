import { describe, it, expect } from 'vitest';
import { TIMELINE_TEMPLATES } from './TimelinePhaseTemplates';

describe('TimelinePhaseTemplates', () => {
    it('should include the indii_28_day_frontloaded template', () => {
        const template = TIMELINE_TEMPLATES['indii_28_day_frontloaded'];
        expect(template).toBeDefined();
        if (template) {
            expect(template.name).toBe('indii Growth Protocol');
            expect(template.phases.length).toBe(4);
            expect(template.phases[0]!.name).toBe('Blitz');
            expect(template.phases[3]!.name).toBe('Harvest & Prep');

            // Check milestones exist
            expect(template.phases[0]!.milestoneTemplates.length).toBeGreaterThan(0);
        }
    });

    it('should include the indii_curator_playlist_builder template', () => {
        const template = TIMELINE_TEMPLATES['indii_curator_playlist_builder'];
        expect(template).toBeDefined();
        if (template) {
            expect(template.name).toBe('indii Curator Playlist Builder');
            expect(template.phases.length).toBe(3);
            expect(template.phases[0]!.name).toBe('Curate');

            // Check milestones
            expect(template.phases[0]!.milestoneTemplates.length).toBeGreaterThan(0);
        }
    });

    it('all templates should have valid relative percentages', () => {
        Object.values(TIMELINE_TEMPLATES).forEach(template => {
            if (!template) return;
            let lastEnd = 0;
            template.phases.forEach((phase, index) => {
                expect(phase.relativeStartPercent).toBeGreaterThanOrEqual(0);
                expect(phase.relativeEndPercent).toBeLessThanOrEqual(1.0);
                expect(phase.relativeStartPercent).toBeLessThan(phase.relativeEndPercent);

                // If it's not the first phase, its start should >= the last phase's end
                if (index > 0) {
                    expect(phase.relativeStartPercent).toBeGreaterThanOrEqual(lastEnd);
                }
                lastEnd = phase.relativeEndPercent;
            });
        });
    });
});
