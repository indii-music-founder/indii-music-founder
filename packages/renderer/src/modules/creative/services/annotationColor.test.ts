import { describe, expect, it } from 'vitest';
import { annotationColor } from './annotationColor';
import { STUDIO_COLORS } from '../constants';

describe('annotation color identity (pure geometry metadata)', () => {
    it.each(STUDIO_COLORS)('recognizes $name brush strokes and filled shapes', color => {
        const rgb = color.hex.match(/\w\w/g)!.map(component => parseInt(component, 16));
        expect(annotationColor({ stroke: `rgba(${rgb.join(', ')}, 0.5)` })?.id).toBe(color.id);
        expect(annotationColor({ fill: color.hex })?.id).toBe(color.id);
        expect(annotationColor({ fill: `rgba(${rgb.join(',')},0.2)` })?.id).toBe(color.id);
    });

    it('keeps stamped identity when the display stroke has been recolored', () => {
        expect(annotationColor({ data: { colorId: 'purple' }, stroke: '#ffffff' })?.id).toBe('purple');
    });

    it('does not mistake unrecognized metadata or artwork colors for a region', () => {
        expect(annotationColor({ data: { colorId: 'unrecognized' }, fill: STUDIO_COLORS[0]!.hex })).toBeUndefined();
        expect(annotationColor({ fill: '#ffffff' })).toBeUndefined();
    });
});
