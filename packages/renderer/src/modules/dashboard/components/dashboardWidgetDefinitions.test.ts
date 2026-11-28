import { describe, expect, it } from 'vitest';
import { WIDGET_DEFINITIONS } from '@/modules/dashboard/components/dashboardWidgetDefinitions';
import { WIDGET_RENDERERS } from '@/modules/dashboard/components/CustomDashboardWidgets';

describe('dashboard widget registry', () => {
    it('gives every picker entry a renderer and every renderer a picker entry', () => {
        expect(Object.keys(WIDGET_RENDERERS).sort()).toEqual(Object.keys(WIDGET_DEFINITIONS).sort());
    });

    it('offers the workspace widgets backed by live project, storage, and knowledge data', () => {
        for (const type of ['recent_projects', 'workspace_stats', 'storage_usage', 'knowledge_base'] as const) {
            expect(WIDGET_DEFINITIONS[type].label).toBeTruthy();
            expect(typeof WIDGET_RENDERERS[type]).toBe('function');
        }
    });
});
