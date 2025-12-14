export const PIXELS_PER_FRAME = 2;

export const ANIMATABLE_PROPERTIES = [
    { key: 'scale', label: 'Scale', min: 0, max: 2, step: 0.1, defaultValue: 1 },
    { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.1, defaultValue: 1 },
    { key: 'rotation', label: 'Rotation', min: 0, max: 360, step: 15, defaultValue: 0 },
    { key: 'x', label: 'Position X', min: -1000, max: 1000, step: 10, defaultValue: 0 },
    { key: 'y', label: 'Position Y', min: -1000, max: 1000, step: 10, defaultValue: 0 },
];
