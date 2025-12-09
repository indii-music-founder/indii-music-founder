export interface TemplateRegion {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number; // In degrees, for spines
    contentTypes: ('text' | 'image' | 'barcode')[];
    description?: string;
}

export interface PrintGuide {
    x: number;
    y: number; // 0 for vertical lines
    orientation: 'vertical' | 'horizontal';
    label: string;
}

export interface PrintTemplate {
    id: string;
    name: string;
    totalWidth: number; // Pixels at 300 DPI (including bleed)
    totalHeight: number; // Pixels at 300 DPI (including bleed)
    dpi: number;
    bleed: number; // Pixels
    regions: TemplateRegion[];
    guides: PrintGuide[];
}

export const PHYSICAL_MEDIA_TEMPLATES: Record<string, PrintTemplate> = {
    cd_front_cover: {
        id: 'cd_front_cover',
        name: 'CD Front Cover (Standard)',
        totalWidth: 1500,
        totalHeight: 1500,
        dpi: 300,
        bleed: 38, // ~1/8 inch
        regions: [
            {
                name: 'Main Artwork',
                x: 38,
                y: 38,
                width: 1424,
                height: 1424,
                contentTypes: ['image', 'text'],
                description: 'Primary front cover artwork'
            }
        ],
        guides: []
    },
    cd_back_inlay: {
        id: 'cd_back_inlay',
        name: 'CD Jewel Case Back Inlay (Tray Card)',
        totalWidth: 1838,
        totalHeight: 1444,
        dpi: 300,
        bleed: 38,
        regions: [
            {
                name: 'Back Panel',
                x: 113, // 38 bleed + 75 spine
                y: 38,
                width: 1612,
                height: 1368,
                contentTypes: ['image', 'text', 'barcode'],
                description: 'Main back cover area for tracklist and legal'
            },
            {
                name: 'Left Spine',
                x: 38,
                y: 38,
                width: 75,
                height: 1368,
                rotation: 270, // Text runs bottom-to-top usually
                contentTypes: ['text'],
                description: 'Left spine (viewed from back)'
            },
            {
                name: 'Right Spine',
                x: 1725, // 113 + 1612
                y: 38,
                width: 75,
                height: 1368,
                rotation: 90, // Text runs top-to-bottom usually
                contentTypes: ['text'],
                description: 'Right spine (viewed from back)'
            }
        ],
        guides: [
            { x: 113, y: 0, orientation: 'vertical', label: 'Left Spine Fold' },
            { x: 1725, y: 0, orientation: 'vertical', label: 'Right Spine Fold' }
        ]
    },
    cassette_jcard_3panel: {
        id: 'cassette_jcard_3panel',
        name: 'Cassette J-Card (3-Panel)',
        totalWidth: 1304,
        totalHeight: 1275,
        dpi: 300,
        bleed: 38,
        regions: [
            {
                name: 'Front Cover',

                // Re-calc: Total 1304. Bleed 38.
                // Front is ~768px wide.
                // Spine is ~148px wide.
                // Flap is ~313px wide.
                // 313 + 148 + 768 = 1229 (+ ~75px variance/bleed? 1304 total)
                // Let's place from Right to Left for J-Card Front.
                // Front is usually the right-most panel when unfolded.
                // X stat = Total - Bleed - Front Width
                // 1304 - 38 - 768 = 498
                x: 498,
                y: 38,
                width: 768,
                height: 1199,
                contentTypes: ['image', 'text'],
                description: 'Front cover art'
            },
            {
                name: 'Spine',
                x: 350, // 498 - 148
                y: 38,
                width: 148,
                height: 1199,
                rotation: 0, // Usually horizontal text on cassette spines
                contentTypes: ['text'],
                description: 'Cassette spine'
            },
            {
                name: 'Back Flap',
                x: 38, // 350 - 312 = 38 (matches bleed start)
                y: 38,
                width: 312,
                height: 1199,
                contentTypes: ['text', 'image'],
                description: 'Short back flap'
            }
        ],
        guides: [
            { x: 350, y: 0, orientation: 'vertical', label: 'Spine Fold (Left)' },
            { x: 498, y: 0, orientation: 'vertical', label: 'Spine Fold (Right/Front)' }
        ]
    },
    vinyl_12_jacket: {
        id: 'vinyl_12_jacket',
        name: '12" Vinyl Record Jacket (Standard)',
        totalWidth: 3825, // ~12.75 inches (12.375 artwork + bleed)
        totalHeight: 3825,
        dpi: 300,
        bleed: 38,
        regions: [
            {
                name: 'Front Architecture',
                x: 38,
                y: 38,
                width: 3749, // ~12.5 inches
                height: 3749,
                contentTypes: ['image', 'text'],
                description: 'Main vinyl cover art'
            }
        ],
        guides: []
    },
    vinyl_12_label: {
        id: 'vinyl_12_label',
        name: '12" Vinyl Center Label (A-Side)',
        totalWidth: 1252, // ~106mm (100mm + 3mm bleed each side)
        totalHeight: 1252,
        dpi: 300,
        bleed: 36, // ~3mm
        regions: [
            {
                name: 'Label Art',
                x: 36,
                y: 36,
                width: 1180, // ~100mm
                height: 1180,
                contentTypes: ['image', 'text'],
                description: 'Circular center label. Keep center 7mm clear.'
            }
        ],
        guides: [
            { x: 626, y: 0, orientation: 'vertical', label: 'Center Hole Guide' }
            // Ideally we'd have a circular guide, but vertical/horizontal crosshair helps
        ]
    },
    poster_11x17: {
        id: 'poster_11x17',
        name: 'Concert Poster (11x17)',
        totalWidth: 3375, // 11.25" (11 + .125 x2)
        totalHeight: 5175, // 17.25"
        dpi: 300,
        bleed: 38,
        regions: [
            {
                name: 'Main Poster Area',
                x: 38,
                y: 38,
                width: 3299,
                height: 5099,
                contentTypes: ['image', 'text'],
                description: 'Full poster canvas'
            }
        ],
        guides: []
    },
    poster_18x24: {
        id: 'poster_18x24',
        name: 'Concert Poster (18x24)',
        totalWidth: 5475,
        totalHeight: 7275,
        dpi: 300,
        bleed: 38,
        regions: [{
            name: 'Main Poster Area',
            x: 38, y: 38, width: 5399, height: 7199,
            contentTypes: ['image', 'text']
        }],
        guides: []
    },
    poster_24x36: {
        id: 'poster_24x36',
        name: 'Concert Poster (24x36)',
        totalWidth: 7275,
        totalHeight: 10875,
        dpi: 300,
        bleed: 38,
        regions: [{
            name: 'Main Poster Area',
            x: 38, y: 38, width: 7199, height: 10799,
            contentTypes: ['image', 'text']
        }],
        guides: []
    }
};
