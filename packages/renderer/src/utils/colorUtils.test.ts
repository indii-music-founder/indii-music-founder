import { describe, it, expect } from 'vitest';
import { parseColor } from './colorUtils';

describe('parseColor', () => {
    it('parses a clean 6-digit hex code as-is', () => {
        expect(parseColor('#FF0000')).toEqual({ hex: '#FF0000', label: '#FF0000' });
    });

    it('expands a 3-digit hex code', () => {
        expect(parseColor('#F00')).toEqual({ hex: '#FF0000', label: '#F00' });
    });

    it('extracts hex from a "Name (#hex)" string', () => {
        const result = parseColor('Midnight Shadow (#0F172A)');
        expect(result.hex).toBe('#0F172A');
        expect(result.label).toBe('Midnight Shadow');
    });

    it('resolves a real CSS color keyword to its hex value', () => {
        expect(parseColor('red').hex.toLowerCase()).toBe('#ff0000');
    });

    it('does not silently resolve a made-up color name to white', () => {
        // Regression: an invalid CSS color assignment leaves style.color empty,
        // but the computed color inherits the ambient text color — near-white
        // in this app's dark theme. A naive "is computed color non-black" check
        // treats every made-up name as a "valid" white color instead of falling
        // through to the name-map/hash fallback.
        const names = ['Morning Mist Blue', 'Golden Hour Amber', 'Twilight Plum'];
        for (const name of names) {
            const { hex } = parseColor(name);
            expect(hex.toLowerCase()).not.toBe('#ffffff');
            expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    it('gives distinct made-up names distinct colors', () => {
        const a = parseColor('Morning Mist Blue').hex;
        const b = parseColor('Golden Hour Amber').hex;
        const c = parseColor('Twilight Plum').hex;
        expect(new Set([a, b, c]).size).toBe(3);
    });

    it('uses the curated fallback for a known creative name', () => {
        expect(parseColor('Midnight Shadow').hex).toBe('#0b0c10');
    });

    it('is deterministic for the same made-up name', () => {
        expect(parseColor('Golden Hour Amber').hex).toBe(parseColor('Golden Hour Amber').hex);
    });

    it('falls back to black for an empty string', () => {
        expect(parseColor('')).toEqual({ hex: '#000000', label: 'Black' });
    });
});
