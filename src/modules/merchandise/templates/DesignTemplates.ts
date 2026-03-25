/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
/**
 * Design Templates for Indie Music Artists
 *
 * Pre-made templates optimized for common merch use cases:
 * - Album artwork layouts
 * - Tour poster designs
 * - Band logo placements
 * - Social media assets
 * - Vinyl/CD packaging
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const TemplateElementSchema = z.object({
    id: z.string(),
    type: z.enum(['text', 'image', 'shape', 'placeholder']),
    name: z.string(),
    // Position and size (percentages for responsive scaling)
    x: z.number(), // 0-100
    y: z.number(), // 0-100
    width: z.number(), // 0-100
    height: z.number(), // 0-100
    // Style
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    opacity: z.number().min(0).max(1).default(1),
    // Text specific
    content: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(), // relative size
    fontWeight: z.string().optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    // Image specific
    imageUrl: z.string().optional(),
    placeholder: z.boolean().optional(), // If true, user should replace this
    // Rotation
    angle: z.number().default(0),
    // Layer order
    zIndex: z.number().default(0),
    // Editability
    locked: z.boolean().default(false),
    editable: z.boolean().default(true)
});

export type TemplateElement = z.infer<typeof TemplateElementSchema>;

export const DesignTemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.enum([
        'album-art',
        'tour-poster',
        'band-logo',
        'vinyl-packaging',
        'cd-packaging',
        'cassette-packaging',
        'merch-graphic',
        'social-media',
        'flyer',
        'ticket'
    ]),
    tags: z.array(z.string()),
    // Canvas settings
    canvasWidth: z.number(),
    canvasHeight: z.number(),
    backgroundColor: z.string().default('#000000'),
    // Template elements
    elements: z.array(TemplateElementSchema),
    // Preview image
    thumbnailUrl: z.string().optional(),
    // Recommended product types
    recommendedProducts: z.array(z.string()).optional(),
    // Styling hints
    colorPalette: z.array(z.string()).optional(),
    fontSuggestions: z.array(z.string()).optional(),
    // Metadata
    isPro: z.boolean().default(false),
    createdAt: z.string().optional()
});

export type DesignTemplate = z.infer<typeof DesignTemplateSchema>;

// ============================================================================
// Built-in Templates for Indie Artists
// ============================================================================

export const INDIE_ARTIST_TEMPLATES: z.input<typeof DesignTemplateSchema>[] = [
    // =========================================================================
    // Album Art Templates
    // =========================================================================
    {
        id: 'album-cover-minimal',
        name: 'Minimal Album Cover',
        description: 'Clean, modern album cover with centered artwork and subtle typography',
        category: 'album-art',
        tags: ['minimal', 'modern', 'clean', 'album'],
        canvasWidth: 3000,
        canvasHeight: 3000,
        backgroundColor: '#0a0a0a',
        elements: [
            {
                id: 'artwork-placeholder',
                type: 'placeholder',
                name: 'Album Artwork',
                x: 10,
                y: 10,
                width: 80,
                height: 70,
                fill: '#1a1a1a',
                placeholder: true,
                zIndex: 1,
                editable: true
            },
            {
                id: 'artist-name',
                type: 'text',
                name: 'Artist Name',
                x: 10,
                y: 82,
                width: 80,
                height: 8,
                content: 'ARTIST NAME',
                fontFamily: 'Inter',
                fontSize: 48,
                fontWeight: '700',
                textAlign: 'left',
                fill: '#ffffff',
                zIndex: 2,
                editable: true
            },
            {
                id: 'album-title',
                type: 'text',
                name: 'Album Title',
                x: 10,
                y: 90,
                width: 80,
                height: 6,
                content: 'Album Title',
                fontFamily: 'Inter',
                fontSize: 24,
                fontWeight: '400',
                textAlign: 'left',
                fill: '#666666',
                zIndex: 2,
                editable: true
            }
        ],
        recommendedProducts: ['Vinyl Record', 'CD', 'Poster'],
        colorPalette: ['#0a0a0a', '#ffffff', '#666666'],
        fontSuggestions: ['Inter', 'Helvetica Neue', 'SF Pro']
    },
    {
        id: 'album-cover-bold',
        name: 'Bold Statement Album',
        description: 'High-impact album cover with large typography and strong contrast',
        category: 'album-art',
        tags: ['bold', 'typography', 'statement', 'album'],
        canvasWidth: 3000,
        canvasHeight: 3000,
        backgroundColor: '#FFE135',
        elements: [
            {
                id: 'artist-name-large',
                type: 'text',
                name: 'Artist Name',
                x: 5,
                y: 20,
                width: 90,
                height: 30,
                content: 'ARTIST',
                fontFamily: 'Impact',
                fontSize: 120,
                fontWeight: '900',
                textAlign: 'center',
                fill: '#000000',
                zIndex: 2,
                editable: true
            },
            {
                id: 'album-title-large',
                type: 'text',
                name: 'Album Title',
                x: 5,
                y: 50,
                width: 90,
                height: 25,
                content: 'ALBUM',
                fontFamily: 'Impact',
                fontSize: 100,
                fontWeight: '900',
                textAlign: 'center',
                fill: '#000000',
                opacity: 0.3,
                zIndex: 1,
                editable: true
            },
            {
                id: 'year',
                type: 'text',
                name: 'Year',
                x: 5,
                y: 85,
                width: 90,
                height: 10,
                content: '2026',
                fontFamily: 'Impact',
                fontSize: 32,
                fontWeight: '700',
                textAlign: 'center',
                fill: '#000000',
                zIndex: 2,
                editable: true
            }
        ],
        recommendedProducts: ['T-Shirt', 'Poster', 'Vinyl Record'],
        colorPalette: ['#FFE135', '#000000', '#ffffff'],
        fontSuggestions: ['Impact', 'Bebas Neue', 'Oswald']
    },
    {
        id: 'album-cover-photo',
        name: 'Photo Album Cover',
        description: 'Photography-focused album cover with elegant text overlay',
        category: 'album-art',
        tags: ['photo', 'portrait', 'elegant', 'album'],
        canvasWidth: 3000,
        canvasHeight: 3000,
        backgroundColor: '#000000',
        elements: [
            {
                id: 'photo-placeholder',
                type: 'placeholder',
                name: 'Cover Photo',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                fill: '#1a1a1a',
                placeholder: true,
                zIndex: 1,
                editable: true
            },
            {
                id: 'gradient-overlay',
                type: 'shape',
                name: 'Gradient Overlay',
                x: 0,
                y: 60,
                width: 100,
                height: 40,
                fill: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                zIndex: 2,
                locked: true,
                editable: false
            },
            {
                id: 'artist-name',
                type: 'text',
                name: 'Artist Name',
                x: 5,
                y: 78,
                width: 90,
                height: 12,
                content: 'Artist Name',
                fontFamily: 'Playfair Display',
                fontSize: 56,
                fontWeight: '700',
                textAlign: 'left',
                fill: '#ffffff',
                zIndex: 3,
                editable: true
            },
            {
                id: 'album-title',
                type: 'text',
                name: 'Album Title',
                x: 5,
                y: 90,
                width: 90,
                height: 8,
                content: 'Album Title',
                fontFamily: 'Playfair Display',
                fontSize: 28,
                fontWeight: '400',
                textAlign: 'left',
                fill: '#cccccc',
                zIndex: 3,
                editable: true
            }
        ],
        recommendedProducts: ['Vinyl Record', 'CD', 'Poster'],
        colorPalette: ['#000000', '#ffffff', '#cccccc'],
        fontSuggestions: ['Playfair Display', 'Cormorant', 'Libre Baskerville']
    },

    // =========================================================================
    // Tour Poster Templates
    // =========================================================================
    {
        id: 'tour-poster-classic',
        name: 'Classic Tour Poster',
        description: 'Traditional tour poster layout with dates and venues',
        category: 'tour-poster',
        tags: ['tour', 'concert', 'dates', 'classic'],
        canvasWidth: 1800,
        canvasHeight: 2700,
        backgroundColor: '#0f0f0f',
        elements: [
            {
                id: 'header-band',
                type: 'text',
                name: 'Band Name',
                x: 5,
                y: 5,
                width: 90,
                height: 15,
                content: 'BAND NAME',
                fontFamily: 'Oswald',
                fontSize: 72,
                fontWeight: '700',
                textAlign: 'center',
                fill: '#FFE135',
                zIndex: 2,
                editable: true
            },
            {
                id: 'tour-name',
                type: 'text',
                name: 'Tour Name',
                x: 5,
                y: 20,
                width: 90,
                height: 8,
                content: 'THE WORLD TOUR 2026',
                fontFamily: 'Oswald',
                fontSize: 28,
                fontWeight: '400',
                textAlign: 'center',
                fill: '#ffffff',
                zIndex: 2,
                editable: true
            },
            {
                id: 'artwork-area',
                type: 'placeholder',
                name: 'Tour Artwork',
                x: 10,
                y: 30,
                width: 80,
                height: 35,
                fill: '#1a1a1a',
                placeholder: true,
                zIndex: 1,
                editable: true
            },
            {
                id: 'dates-section',
                type: 'text',
                name: 'Tour Dates',
                x: 5,
                y: 68,
                width: 90,
                height: 25,
                content: 'JAN 15 — LOS ANGELES, CA — THE FORUM\nJAN 18 — SAN FRANCISCO, CA — WARFIELD\nJAN 22 — PORTLAND, OR — ROSELAND\nJAN 25 — SEATTLE, WA — PARAMOUNT\nJAN 28 — DENVER, CO — RED ROCKS',
                fontFamily: 'Space Mono',
                fontSize: 14,
                fontWeight: '400',
                textAlign: 'center',
                fill: '#cccccc',
                zIndex: 2,
                editable: true
            },
            {
                id: 'tickets-cta',
                type: 'text',
                name: 'Tickets CTA',
                x: 5,
                y: 94,
                width: 90,
                height: 5,
                content: 'TICKETS AT BANDNAME.COM',
                fontFamily: 'Oswald',
                fontSize: 18,
                fontWeight: '600',
                textAlign: 'center',
                fill: '#FFE135',
                zIndex: 2,
                editable: true
            }
        ],
        recommendedProducts: ['Poster', 'Flag'],
        colorPalette: ['#0f0f0f', '#FFE135', '#ffffff', '#cccccc'],
        fontSuggestions: ['Oswald', 'Space Mono', 'Bebas Neue']
    },

    // =========================================================================
    // Merch Graphic Templates
    // =========================================================================
    {
        id: 'merch-centered-logo',
        name: 'Centered Logo Graphic',
        description: 'Simple centered logo placement for t-shirts and hoodies',
        category: 'merch-graphic',
        tags: ['logo', 'centered', 'simple', 'apparel'],
        canvasWidth: 4500,
        canvasHeight: 5400,
        backgroundColor: 'transparent',
        elements: [
            {
                id: 'logo-placeholder',
                type: 'placeholder',
                name: 'Your Logo',
                x: 25,
                y: 20,
                width: 50,
                height: 40,
                fill: '#333333',
                placeholder: true,
                zIndex: 1,
                editable: true
            },
            {
                id: 'tagline',
                type: 'text',
                name: 'Tagline',
                x: 15,
                y: 65,
                width: 70,
                height: 10,
                content: 'YOUR TAGLINE HERE',
                fontFamily: 'Inter',
                fontSize: 24,
                fontWeight: '600',
                textAlign: 'center',
                fill: '#ffffff',
                zIndex: 2,
                editable: true
            }
        ],
        recommendedProducts: ['T-Shirt', 'Hoodie', 'Tote Bag'],
        colorPalette: ['transparent', '#ffffff', '#000000'],
        fontSuggestions: ['Inter', 'Montserrat', 'Poppins']
    },
    {
        id: 'merch-back-print',
        name: 'Back Print Tour Design',
        description: 'Large back print design with tour dates',
        category: 'merch-graphic',
        tags: ['back-print', 'tour', 'dates', 'apparel'],
        canvasWidth: 4500,
        canvasHeight: 5400,
        backgroundColor: 'transparent',
        elements: [
            {
                id: 'main-graphic',
                type: 'placeholder',
                name: 'Main Graphic',
                x: 15,
                y: 5,
                width: 70,
                height: 45,
                fill: '#333333',
                placeholder: true,
                zIndex: 1,
                editable: true
            },
            {
                id: 'tour-title',
                type: 'text',
                name: 'Tour Title',
                x: 10,
                y: 52,
                width: 80,
                height: 8,
                content: 'WORLD TOUR 2026',
                fontFamily: 'Bebas Neue',
                fontSize: 36,
                fontWeight: '700',
                textAlign: 'center',
                fill: '#FFE135',
                zIndex: 2,
                editable: true
            },
            {
                id: 'tour-dates-list',
                type: 'text',
                name: 'Tour Dates',
                x: 10,
                y: 62,
                width: 80,
                height: 35,
                content: 'LOS ANGELES • SAN FRANCISCO\nPORTLAND • SEATTLE • DENVER\nCHICAGO • DETROIT • NEW YORK\nBOSTON • PHILADELPHIA • ATLANTA\nMIAMI • DALLAS • AUSTIN',
                fontFamily: 'Space Mono',
                fontSize: 14,
                fontWeight: '400',
                textAlign: 'center',
                fill: '#ffffff',
                zIndex: 2,
                editable: true
            }
        ],
        recommendedProducts: ['T-Shirt', 'Hoodie'],
        colorPalette: ['transparent', '#FFE135', '#ffffff'],
        fontSuggestions: ['Bebas Neue', 'Space Mono', 'Oswald']
    },

    // =========================================================================
    // Vinyl Packaging Templates
    // =========================================================================
    {
        id: 'vinyl-sleeve-front',
        name: 'Vinyl Sleeve Front',
        description: '12" vinyl sleeve front cover design',
        category: 'vinyl-packaging',
        tags: ['vinyl', 'sleeve', 'cover', 'record'],
        canvasWidth: 3600,
        canvasHeight: 3600,
        backgroundColor: '#000000',
        elements: [
            {
                id: 'cover-art',
                type: 'placeholder',
                name: 'Cover Artwork',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                fill: '#1a1a1a',
                placeholder: true,
                zIndex: 1,
                editable: true
            }
        ],
        recommendedProducts: ['Vinyl Record'],
        colorPalette: ['#000000', '#ffffff'],
        fontSuggestions: ['Helvetica Neue', 'Futura', 'Gill Sans']
    },
    {
        id: 'vinyl-center-label',
        name: 'Vinyl Center Label',
        description: 'Center label design for vinyl records',
        category: 'vinyl-packaging',
        tags: ['vinyl', 'label', 'center', 'record'],
        canvasWidth: 1200,
        canvasHeight: 1200,
        backgroundColor: '#FFE135',
        elements: [
            {
                id: 'center-hole',
                type: 'shape',
                name: 'Center Hole',
                x: 45,
                y: 45,
                width: 10,
                height: 10,
                fill: '#000000',
                zIndex: 3,
                locked: true,
                editable: false
            },
            {
                id: 'artist-name',
                type: 'text',
                name: 'Artist',
                x: 10,
                y: 20,
                width: 80,
                height: 15,
                content: 'ARTIST NAME',
                fontFamily: 'Helvetica Neue',
                fontSize: 24,
                fontWeight: '700',
                textAlign: 'center',
                fill: '#000000',
                zIndex: 2,
                editable: true
            },
            {
                id: 'album-title',
                type: 'text',
                name: 'Album',
                x: 10,
                y: 60,
                width: 80,
                height: 12,
                content: 'Album Title',
                fontFamily: 'Helvetica Neue',
                fontSize: 18,
                fontWeight: '400',
                textAlign: 'center',
                fill: '#000000',
                zIndex: 2,
                editable: true
            },
            {
                id: 'side-indicator',
                type: 'text',
                name: 'Side',
                x: 10,
                y: 75,
                width: 80,
                height: 10,
                content: 'SIDE A',
                fontFamily: 'Helvetica Neue',
                fontSize: 14,
                fontWeight: '600',
                textAlign: 'center',
                fill: '#000000',
                zIndex: 2,
                editable: true
            }
        ],
        recommendedProducts: ['Vinyl Record'],
        colorPalette: ['#FFE135', '#000000'],
        fontSuggestions: ['Helvetica Neue', 'Futura', 'DIN']
    },

    // =========================================================================
    // Social Media Templates
    // =========================================================================
    {
        id: 'social-release-announcement',
        name: 'Release Announcement',
        description: 'Square post for announcing new releases',
        category: 'social-media',
        tags: ['social', 'instagram', 'announcement', 'release'],
        canvasWidth: 1080,
        canvasHeight: 1080,
        backgroundColor: '#0a0a0a',
        elements: [
            {
                id: 'album-art',
                type: 'placeholder',
                name: 'Album Art',
                x: 15,
                y: 15,
                width: 70,
                height: 55,
                fill: '#1a1a1a',
                placeholder: true,
                zIndex: 1,
                editable: true
            },
            {
                id: 'out-now',
                type: 'text',
                name: 'Status',
                x: 10,
                y: 75,
                width: 80,
                height: 8,
                content: 'OUT NOW',
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: '800',
                textAlign: 'center',
                fill: '#FFE135',
                zIndex: 2,
                editable: true
            },
            {
                id: 'title',
                type: 'text',
                name: 'Title',
                x: 10,
                y: 83,
                width: 80,
                height: 10,
                content: '"TRACK NAME"',
                fontFamily: 'Inter',
                fontSize: 24,
                fontWeight: '700',
                textAlign: 'center',
                fill: '#ffffff',
                zIndex: 2,
                editable: true
            },
            {
                id: 'streaming-text',
                type: 'text',
                name: 'Streaming',
                x: 10,
                y: 93,
                width: 80,
                height: 5,
                content: 'STREAMING EVERYWHERE',
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: '500',
                textAlign: 'center',
                fill: '#666666',
                zIndex: 2,
                editable: true
            }
        ],
        recommendedProducts: ['Sticker Sheet'],
        colorPalette: ['#0a0a0a', '#FFE135', '#ffffff', '#666666'],
        fontSuggestions: ['Inter', 'Montserrat', 'Poppins']
    },
    {
        id: 'social-story-promo',
        name: 'Story Promo',
        description: 'Vertical story format for Instagram/TikTok',
        category: 'social-media',
        tags: ['social', 'story', 'instagram', 'tiktok', 'vertical'],
        canvasWidth: 1080,
        canvasHeight: 1920,
        backgroundColor: '#000000',
        elements: [
            {
                id: 'background-image',
                type: 'placeholder',
                name: 'Background',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                fill: '#1a1a1a',
                placeholder: true,
                zIndex: 1,
                editable: true
            },
            {
                id: 'overlay',
                type: 'shape',
                name: 'Overlay',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                fill: 'rgba(0,0,0,0.4)',
                zIndex: 2,
                locked: true,
                editable: false
            },
            {
                id: 'main-text',
                type: 'text',
                name: 'Main Text',
                x: 10,
                y: 40,
                width: 80,
                height: 20,
                content: 'NEW MUSIC',
                fontFamily: 'Bebas Neue',
                fontSize: 72,
                fontWeight: '700',
                textAlign: 'center',
                fill: '#FFE135',
                zIndex: 3,
                editable: true
            },
            {
                id: 'subtitle',
                type: 'text',
                name: 'Subtitle',
                x: 10,
                y: 58,
                width: 80,
                height: 10,
                content: 'SWIPE UP TO LISTEN',
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: '600',
                textAlign: 'center',
                fill: '#ffffff',
                zIndex: 3,
                editable: true
            }
        ],
        recommendedProducts: [],
        colorPalette: ['#000000', '#FFE135', '#ffffff'],
        fontSuggestions: ['Bebas Neue', 'Inter', 'Montserrat']
    }
];

// ============================================================================
// Template Service
// ============================================================================

export class TemplateService {
    private templates: DesignTemplate[] = INDIE_ARTIST_TEMPLATES.map(t => DesignTemplateSchema.parse(t));

    /**
     * Get all available templates
     */
    getAll(): DesignTemplate[] {
        return this.templates;
    }

    /**
     * Get templates by category
     */
    getByCategory(category: DesignTemplate['category']): DesignTemplate[] {
        return this.templates.filter(t => t.category === category);
    }

    /**
     * Search templates by name or tags
     */
    search(query: string): DesignTemplate[] {
        const lowerQuery = query.toLowerCase();
        return this.templates.filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery) ||
            t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Get template by ID
     */
    getById(id: string): DesignTemplate | undefined {
        return this.templates.find(t => t.id === id);
    }

    /**
     * Get templates recommended for a product type
     */
    getForProduct(productType: string): DesignTemplate[] {
        return this.templates.filter(t =>
            t.recommendedProducts?.some(p =>
                p.toLowerCase() === productType.toLowerCase()
            )
        );
    }

    /**
     * Get template categories with counts
     */
    getCategories(): { category: DesignTemplate['category']; count: number; label: string }[] {
        const categoryLabels: Record<DesignTemplate['category'], string> = {
            'album-art': 'Album Art',
            'tour-poster': 'Tour Posters',
            'band-logo': 'Band Logos',
            'vinyl-packaging': 'Vinyl Packaging',
            'cd-packaging': 'CD Packaging',
            'cassette-packaging': 'Cassette Packaging',
            'merch-graphic': 'Merch Graphics',
            'social-media': 'Social Media',
            'flyer': 'Flyers',
            'ticket': 'Tickets'
        };

        const counts = new Map<DesignTemplate['category'], number>();
        this.templates.forEach(t => {
            counts.set(t.category, (counts.get(t.category) || 0) + 1);
        });

        return Array.from(counts.entries()).map(([category, count]) => ({
            category,
            count,
            label: categoryLabels[category]
        }));
    }

    /**
     * Add a custom template
     */
    addTemplate(template: DesignTemplate): void {
        this.templates.push(template);
    }

    /**
     * Convert template elements to Fabric.js compatible objects
     */
    toFabricObjects(template: DesignTemplate): any[] {
        return template.elements.map(element => {
            const baseProps = {
                left: (element.x / 100) * template.canvasWidth,
                top: (element.y / 100) * template.canvasHeight,
                width: (element.width / 100) * template.canvasWidth,
                height: (element.height / 100) * template.canvasHeight,
                angle: element.angle,
                opacity: element.opacity,
                selectable: element.editable,
                evented: element.editable,
                name: element.name
            };

            switch (element.type) {
                case 'text':
                    return {
                        type: 'textbox',
                        ...baseProps,
                        text: element.content || '',
                        fontFamily: element.fontFamily || 'Inter',
                        fontSize: element.fontSize || 24,
                        fontWeight: element.fontWeight || '400',
                        textAlign: element.textAlign || 'left',
                        fill: element.fill || '#ffffff'
                    };

                case 'shape':
                    return {
                        type: 'rect',
                        ...baseProps,
                        fill: element.fill || '#333333',
                        stroke: element.stroke,
                        strokeWidth: element.strokeWidth || 0
                    };

                case 'placeholder':
                case 'image':
                    return {
                        type: 'rect',
                        ...baseProps,
                        fill: element.fill || '#1a1a1a',
                        stroke: '#FFE135',
                        strokeWidth: 2,
                        strokeDashArray: [10, 5],
                        rx: 8,
                        ry: 8,
                        // Mark as placeholder for the UI
                        isPlaceholder: element.placeholder,
                        placeholderText: element.placeholder ? 'Drop image here' : undefined
                    };

                default:
                    return null;
            }
        }).filter(Boolean);
    }
}

// Export singleton instance
export const templateService = new TemplateService();
