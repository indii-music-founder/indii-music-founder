interface ModePickerAnchorRect {
    top: number;
    right: number;
}

interface ModePickerViewport {
    width: number;
    height: number;
}

const VIEWPORT_MARGIN = 12;

/**
 * Anchor the portal to the mode button, but keep it reachable when a docked
 * panel is transformed beyond the CSS viewport (for example at browser zoom
 * or in the web-preview layout).
 */
export function getModePickerPosition(
    rect: ModePickerAnchorRect,
    viewport: ModePickerViewport,
): { right: number; bottom: number } {
    return {
        right: Math.max(VIEWPORT_MARGIN, viewport.width - rect.right),
        bottom: Math.max(VIEWPORT_MARGIN, viewport.height - rect.top + VIEWPORT_MARGIN),
    };
}
