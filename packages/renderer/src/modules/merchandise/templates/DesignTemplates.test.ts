import { describe, it, expect } from 'vitest';
import { templateService } from './DesignTemplates';

describe('DesignTemplates (ISSUE-1607)', () => {
    it('scales Classic Tour Poster coordinates within the 800x1000 DesignCanvas artboard without clipping', () => {
        const poster = templateService.getById('tour-poster-classic');
        expect(poster).toBeDefined();

        const objects = templateService.toFabricObjects(poster!, { width: 800, height: 1000 });
        expect(objects).toHaveLength(5);

        for (const obj of objects) {
            expect(obj.left).toBeGreaterThanOrEqual(0);
            expect(obj.top).toBeGreaterThanOrEqual(0);
            expect(obj.left + obj.width).toBeLessThanOrEqual(800);
            expect(obj.top + (obj.height ?? 0)).toBeLessThanOrEqual(1000);
        }

        const bandHeader = objects.find((o) => o.name === 'Band Name');
        const ticketsCta = objects.find((o) => o.name === 'Tickets CTA');
        expect(bandHeader?.left).toBe(40);
        expect(bandHeader?.width).toBe(720);
        expect(bandHeader?.fontSize).toBe(72);
        expect(ticketsCta?.top).toBe(940);
        expect(ticketsCta?.fontSize).toBe(18);
    });

    it('keeps all built-in templates inside the 800x1000 target artboard when targetDimensions is supplied', () => {
        const allTemplates = templateService.getAll();
        expect(allTemplates.length).toBeGreaterThan(0);

        for (const tpl of allTemplates) {
            const objects = templateService.toFabricObjects(tpl, { width: 800, height: 1000 });
            for (const obj of objects) {
                expect(obj.left).toBeGreaterThanOrEqual(0);
                expect(obj.top).toBeGreaterThanOrEqual(0);
                expect(obj.left + obj.width).toBeLessThanOrEqual(800.01);
                expect(obj.top + (obj.height ?? 0)).toBeLessThanOrEqual(1000.01);
            }
        }
    });
});
