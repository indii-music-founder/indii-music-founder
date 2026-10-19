// Structural controls only. Full editing, persistence and downloads require the
// genuine-account acceptance walkthrough; no store, authentication or services are mocked.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { LayerList } from '../LayerList';
import { AdjustPanel } from '../AdjustPanel';
import { ExportBar } from '../ExportBar';
import { createDocFromImage, NEUTRAL_ADJUSTMENTS } from '@/services/canvas/CanvasDoc';

afterEach(cleanup);

describe('Artwork controls (structural only)', () => {
    it('shows an empty layer list', () => {
        render(<LayerList layers={[]} selectedLayerId={null} onSelect={vi.fn()} onToggleVisible={vi.fn()} onToggleLock={vi.fn()} />);
        expect(screen.getByText('No layers.')).toBeDefined();
    });

    it('shows the layer name and routes selection separately from visibility and lock', () => {
        const layer = createDocFromImage('data:image/png;base64,AAA', 'literal').layers[0]!;
        const select = vi.fn(), visible = vi.fn(), lock = vi.fn();
        render(<LayerList layers={[layer]} selectedLayerId={layer.id} onSelect={select} onToggleVisible={visible} onToggleLock={lock} />);
        expect(screen.getByText(layer.name)).toBeDefined();
        fireEvent.click(screen.getByTestId(`layer-visibility-${layer.id}`));
        fireEvent.click(screen.getByTestId(`layer-lock-${layer.id}`));
        expect(visible).toHaveBeenCalledWith(layer.id);
        expect(lock).toHaveBeenCalledWith(layer.id);
        expect(select).not.toHaveBeenCalled();
        fireEvent.keyDown(screen.getByTestId(`layer-row-${layer.id}`), { key: 'Enter' });
        expect(select).toHaveBeenCalledWith(layer.id);
    });

    it('converts brightness percent to a signed adjustment and keeps exposure in stops', () => {
        const change = vi.fn();
        render(<AdjustPanel adjustments={NEUTRAL_ADJUSTMENTS} exposureRange={3} onChange={change} />);
        fireEvent.change(screen.getByTestId('adjust-brightness'), { target: { value: '-40' } });
        expect(change).toHaveBeenLastCalledWith({ brightness: -0.4 });
        fireEvent.change(screen.getByTestId('adjust-exposure'), { target: { value: '1.5' } });
        expect(change).toHaveBeenLastCalledWith({ exposure: 1.5 });
    });

    it('defaults to PNG at document size and reports doubled dimensions before export', () => {
        const exportArtwork = vi.fn();
        render(<ExportBar width={3000} height={3000} onExport={exportArtwork} />);
        fireEvent.click(screen.getByTestId('canvas-export'));
        expect(exportArtwork).toHaveBeenLastCalledWith('png', 1);
        fireEvent.change(screen.getByTestId('export-format'), { target: { value: 'jpeg' } });
        fireEvent.change(screen.getByTestId('export-scale'), { target: { value: '2' } });
        expect(screen.getByText('6000 × 6000 pixels')).toBeDefined();
        fireEvent.click(screen.getByTestId('canvas-export'));
        expect(exportArtwork).toHaveBeenLastCalledWith('jpeg', 2);
    });

    it('prevents export while artwork is loading', () => {
        const exportArtwork = vi.fn();
        render(<ExportBar disabled onExport={exportArtwork} />);
        fireEvent.click(screen.getByTestId('canvas-export'));
        expect(exportArtwork).not.toHaveBeenCalled();
    });
});
