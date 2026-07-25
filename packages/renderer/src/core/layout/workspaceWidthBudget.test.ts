import { describe, expect, it } from 'vitest';
import { getRightPanelLayout } from './workspaceWidthBudget';

describe('getRightPanelLayout', () => {
    it('honors the preferred width when there is room for the workspace and chat', () => {
        expect(getRightPanelLayout({
            viewportWidth: 1920,
            isSidebarOpen: true,
            isRightPanelOpen: true,
            preferredPanelWidth: 800,
        })).toMatchObject({
            canOpenPanel: true,
            isPanelOpen: true,
            effectivePanelWidth: 800,
        });
    });

    it('caps chat width before reducing the module below its readable minimum', () => {
        expect(getRightPanelLayout({
            viewportWidth: 1440,
            isSidebarOpen: true,
            isRightPanelOpen: true,
            preferredPanelWidth: 800,
        })).toMatchObject({
            maxPanelWidth: 600,
            effectivePanelWidth: 600,
        });
    });

    it('keeps the chat collapsed when opening it would crush the active workspace', () => {
        expect(getRightPanelLayout({
            viewportWidth: 1025,
            isSidebarOpen: true,
            isRightPanelOpen: true,
            preferredPanelWidth: 480,
        })).toMatchObject({
            canOpenPanel: false,
            isPanelOpen: false,
            effectivePanelWidth: 48,
        });
    });
});
