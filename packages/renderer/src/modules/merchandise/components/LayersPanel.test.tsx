import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasObject } from './DesignCanvas';
import { LayersPanel } from './LayersPanel';

describe('merchandise text properties', () => {
    it('edits content and font from labeled controls and preserves the restored font option', () => {
        const layer: CanvasObject = {
            id: 'text-layer',
            name: 'Title',
            type: 'text',
            visible: true,
            locked: false,
            fabricObject: { text: 'Original', fontFamily: 'Custom Imported Font' } as unknown as CanvasObject['fabricObject'],
        };
        const onUpdateProperty = vi.fn();
        render(<LayersPanel
            layers={[layer]}
            selectedLayer={layer}
            onUpdateProperty={onUpdateProperty}
            onSelectLayer={vi.fn()}
            onToggleVisibility={vi.fn()}
            onToggleLock={vi.fn()}
            onDeleteLayer={vi.fn()}
            onReorderLayer={vi.fn()}
        />);

        const text = screen.getByRole('textbox', { name: 'Text content' });
        expect(text).toHaveValue('Original');
        fireEvent.change(text, { target: { value: 'New title' } });
        expect(onUpdateProperty).not.toHaveBeenCalled();
        fireEvent.blur(text);
        expect(onUpdateProperty).toHaveBeenCalledWith(layer, 'text', 'New title');

        const font = screen.getByRole('combobox', { name: 'Font family' });
        expect(font).toHaveValue('Custom Imported Font');
        fireEvent.change(font, { target: { value: 'Georgia' } });
        expect(onUpdateProperty).toHaveBeenCalledWith(layer, 'fontFamily', 'Georgia');
    });
});
