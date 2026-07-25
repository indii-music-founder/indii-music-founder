export const MIN_MODULE_WORKSPACE_WIDTH = 560;
export const MIN_RIGHT_PANEL_WIDTH = 320;
export const COLLAPSED_RIGHT_PANEL_WIDTH = 48;
const MAX_RIGHT_PANEL_WIDTH = 800;

export interface RightPanelLayoutInput {
    viewportWidth: number;
    isSidebarOpen: boolean;
    isRightPanelOpen: boolean;
    preferredPanelWidth: number;
}

/**
 * Reserve enough horizontal space for the active workspace before opening the
 * global chat panel. This prevents a third pane from crushing a department UI.
 */
export function getRightPanelLayout({
    viewportWidth,
    isSidebarOpen,
    isRightPanelOpen,
    preferredPanelWidth,
}: RightPanelLayoutInput) {
    const sidebarWidth = isSidebarOpen ? 280 : 80;
    const maxPanelWidth = Math.min(
        MAX_RIGHT_PANEL_WIDTH,
        viewportWidth - sidebarWidth - MIN_MODULE_WORKSPACE_WIDTH,
    );
    const canOpenPanel = maxPanelWidth >= MIN_RIGHT_PANEL_WIDTH;
    const isPanelOpen = isRightPanelOpen && canOpenPanel;
    const requestedWidth = Number.isFinite(preferredPanelWidth)
        ? preferredPanelWidth
        : MIN_RIGHT_PANEL_WIDTH;

    return {
        maxPanelWidth,
        canOpenPanel,
        isPanelOpen,
        effectivePanelWidth: isPanelOpen
            ? Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(requestedWidth, maxPanelWidth))
            : COLLAPSED_RIGHT_PANEL_WIDTH,
    };
}
