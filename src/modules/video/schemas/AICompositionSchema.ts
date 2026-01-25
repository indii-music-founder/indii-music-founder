import { z } from 'zod';

// Element position - can be number (pixels) or string ("center")
const PositionValueSchema = z.union([z.number(), z.literal('center')]);

// Element size - can be number (pixels) or string ("auto", "fill")
const SizeValueSchema = z.union([z.number(), z.literal('auto'), z.literal('fill')]);

// Easing options for animations
export const EasingSchema = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut']);

// Keyframe for property animation
export const KeyframeSchema = z.object({
    frame: z.number().int().min(0),
    value: z.number(),
    easing: EasingSchema.optional().default('linear'),
});

// Animation configuration for elements
export const AnimationSchema = z.object({
    enter: z.enum(['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'none']).optional(),
    exit: z.enum(['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom', 'none']).optional(),
    enterDuration: z.number().int().min(1).optional().default(15),
    exitDuration: z.number().int().min(1).optional().default(15),
});

// Style properties for elements
export const ElementStyleSchema = z.object({
    fontSize: z.number().min(1).optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    opacity: z.number().min(0).max(1).optional().default(1),
    backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    borderRadius: z.number().min(0).optional(),
    padding: z.number().min(0).optional(),
});

// Scene element (text, image, video, audio, shape)
export const SceneElementSchema = z.object({
    id: z.string().min(1),
    type: z.enum(['text', 'image', 'video', 'audio', 'shape']),
    content: z.string().optional(), // text content or src URL
    position: z.object({
        x: PositionValueSchema,
        y: PositionValueSchema,
    }),
    size: z.object({
        width: SizeValueSchema,
        height: SizeValueSchema,
    }).optional(),
    style: ElementStyleSchema.optional(),
    animation: AnimationSchema.optional(),
    keyframes: z.record(z.array(KeyframeSchema)).optional(),
    // Audio-specific
    volume: z.number().min(0).max(1).optional(),
    // Video-specific
    trimStart: z.number().int().min(0).optional(),
    trimEnd: z.number().int().min(0).optional(),
});

// Background configuration
export const BackgroundSchema = z.object({
    type: z.enum(['color', 'gradient', 'image', 'video']),
    value: z.string(), // hex color, gradient CSS, or URL
});

// Scene transition
export const TransitionSchema = z.object({
    type: z.enum(['cut', 'fade', 'wipe', 'slide', 'zoom']),
    duration: z.number().int().min(1).default(15),
});

// Individual scene in the composition
export const SceneSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    startFrame: z.number().int().min(0),
    durationInFrames: z.number().int().min(1),
    background: BackgroundSchema.optional(),
    elements: z.array(SceneElementSchema).default([]),
    transition: TransitionSchema.optional(),
});

// Audio configuration
export const AudioConfigSchema = z.object({
    backgroundMusic: z.object({
        src: z.string().url(),
        volume: z.number().min(0).max(1).default(0.5),
        fadeInFrames: z.number().int().min(0).optional(),
        fadeOutFrames: z.number().int().min(0).optional(),
    }).optional(),
    voiceover: z.object({
        src: z.string().url(),
        startFrame: z.number().int().min(0).default(0),
        volume: z.number().min(0).max(1).default(1),
    }).optional(),
});

// Main AI Composition Schema
export const AICompositionSchema = z.object({
    version: z.literal('1.0'),
    metadata: z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        mood: z.string().optional(),
        colorPalette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).optional(),
    }),
    settings: z.object({
        width: z.number().int().min(1).default(1920),
        height: z.number().int().min(1).default(1080),
        fps: z.number().int().min(1).max(60).default(30),
    }),
    scenes: z.array(SceneSchema).min(1),
    audio: AudioConfigSchema.optional(),
});

// Type exports
export type AIComposition = z.infer<typeof AICompositionSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneElement = z.infer<typeof SceneElementSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type Animation = z.infer<typeof AnimationSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type AudioConfig = z.infer<typeof AudioConfigSchema>;
export type ElementStyle = z.infer<typeof ElementStyleSchema>;
export type Easing = z.infer<typeof EasingSchema>;
