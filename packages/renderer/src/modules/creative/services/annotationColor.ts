import { STUDIO_COLORS, type CreativeColor } from '../constants';

/** Recover region identity from saved metadata, or old brush/shape color values. */
export function annotationColor(object: { data?: { colorId?: string }; stroke?: unknown; fill?: unknown }): CreativeColor | undefined {
    if (object.data?.colorId) return STUDIO_COLORS.find(color => color.id === object.data!.colorId);
    return STUDIO_COLORS.find(color => [object.stroke, object.fill].some(value => {
        if (typeof value !== 'string') return false;
        if (value.toLowerCase() === color.hex.toLowerCase()) return true;
        const rgb = color.hex.match(/\w\w/g)!.map(component => parseInt(component, 16));
        const channels = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,|\s*\))/i);
        return channels ? rgb.every((channel, index) => channel === Number(channels[index + 1])) : false;
    }));
}
