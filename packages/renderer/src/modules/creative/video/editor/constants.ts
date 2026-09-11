export const PIXELS_PER_FRAME = 2;
export const TRACK_HEADER_WIDTH = 192; // w-48 is 12rem = 192px
export const TIMELINE_CONTAINER_PADDING = 8; // p-2 is 0.5rem = 8px
export const TOTAL_TRACK_HEADER_OFFSET = TRACK_HEADER_WIDTH + TIMELINE_CONTAINER_PADDING; // 200px

export type AnimatablePropertyKey = 'scale' | 'opacity' | 'rotation' | 'x' | 'y' | 'volume';

export interface AnimatablePropertyConfig {
    key: AnimatablePropertyKey | string;
    label: string;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
}

export const ANIMATABLE_PROPERTIES: AnimatablePropertyConfig[] = [
    { key: 'scale', label: 'Scale', min: 0, max: 2, step: 0.1, defaultValue: 1 },
    { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.1, defaultValue: 1 },
    { key: 'rotation', label: 'Rotation', min: 0, max: 360, step: 15, defaultValue: 0 },
    { key: 'x', label: 'Position X', min: -1000, max: 1000, step: 10, defaultValue: 0 },
    { key: 'y', label: 'Position Y', min: -1000, max: 1000, step: 10, defaultValue: 0 },
    { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05, defaultValue: 1 },
];
