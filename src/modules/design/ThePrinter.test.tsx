import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { PhysicalMediaLayout } from './components/PhysicalMediaLayout';
import { PHYSICAL_MEDIA_TEMPLATES } from '../../services/design/templates';
import React from 'react';

// Mock Fabric to avoid canvas requirements in Node environment
// We just want to stress test the React Component lifecycle and logic
vi.mock('fabric', () => {
    // Canvas must be a class (constructible)
    class MockCanvas {
        constructor() {
            // no-op
        }
        setZoom = vi.fn();
        dispose = vi.fn();
        clear = vi.fn();
        add = vi.fn();
        renderAll = vi.fn();
    }

    return {
        Canvas: MockCanvas,
        Rect: vi.fn(),
        Line: vi.fn(),
        Text: vi.fn(),
    };
});

describe('The Printer 🖨️ - Physical Media Stress Test', () => {

    // Scenario 1: The Press Run 
    // Render every single template to ensure data integrity and no crashes
    it('The Press Run: Renders all templates without crashing', () => {
        Object.values(PHYSICAL_MEDIA_TEMPLATES).forEach((template) => {
            render(<PhysicalMediaLayout template={template} />);
            cleanup(); // Force unmount
        });
        expect(true).toBe(true); // If we get here, no crash occurred
    });

    // Scenario 2: The Zoom Lens
    // Rapidly change props to trigger re-renders
    it('The Zoom Lens: Survives 100 rapid zoom updates', async () => {
        const template = PHYSICAL_MEDIA_TEMPLATES.cd_front_cover;
        const { rerender } = render(<PhysicalMediaLayout template={template} zoom={0.1} />);

        for (let i = 0; i < 100; i++) {
            // Simulate animation frame updates
            rerender(<PhysicalMediaLayout template={template} zoom={0.1 + (i * 0.01)} />);
        }
        expect(true).toBe(true);
    });

    // Scenario 3: The Ink Spill
    // Rapidly switch templates (mounting/unmounting)
    it('The Ink Spill: Rapid template switching', () => {
        const templates = Object.values(PHYSICAL_MEDIA_TEMPLATES);

        for (let i = 0; i < 50; i++) {
            const t = templates[i % templates.length];
            render(<PhysicalMediaLayout template={t} />);
            cleanup();
        }
        expect(true).toBe(true);
    });
});
