
export const EVOLUTION_STAGES = [
    { pct: 0, icon: '🦠' },
    { pct: 15, icon: '🐟' },
    { pct: 30, icon: '🦎' },
    { pct: 45, icon: '🦖' },
    { pct: 60, icon: '🐒' },
    { pct: 75, icon: '🦍' },
    { pct: 90, icon: '🚶' },
    { pct: 100, icon: '🧍' }
];

// Image Aspect Ratios
export const ASPECT_RATIOS = [
    { label: '1:1', value: '1:1', icon: 'Square' },
    { label: '16:9', value: '16:9', icon: 'RectangleHorizontal' },
    { label: '9:16', value: '9:16', icon: 'RectangleVertical' },
    { label: '4:3', value: '4:3', icon: 'Monitor' },
    { label: '3:4', value: '3:4', icon: 'Tablet' },
    { label: '21:9', value: '21:9', icon: 'Wide' }, // Panoramic
];

export interface NanaColor {
    id: string;
    name: string;
    hex: string;
}

export const NANA_COLORS: NanaColor[] = [
    { id: 'purple', name: 'Purple', hex: '#A855F7' },
    { id: 'red', name: 'Red', hex: '#EF4444' },
    { id: 'yellow', name: 'Yellow', hex: '#EAB308' },
    { id: 'blue', name: 'Blue', hex: '#3B82F6' },
    { id: 'green', name: 'Green', hex: '#22C55E' },
    { id: 'orange', name: 'Orange', hex: '#F97316' },
    { id: 'cyan', name: 'Cyan', hex: '#06B6D4' },
    { id: 'magenta', name: 'Magenta', hex: '#D946EF' },
];

export const STUDIO_TAGS: Record<string, Record<string, string[]> | string[]> = {
    "Camera": {
        "Digital Cinema": ["Arri Alexa LF", "Red V-Raptor XL", "Sony Venice 2", "Blackmagic Ursa 12K", "Canon C500 Mark II"],
        "Mirrorless & DSLR": ["Sony A7R V", "Canon EOS R5", "Nikon Z9", "Fujifilm GFX 100 II", "Hasselblad X2D 100C", "Leica SL2"],
        "Analog Film": ["Panavision Millennium XL2", "Arriflex 435", "Leica M6", "Hasselblad 500C/M", "Mamiya RZ67", "Polaroid SX-70"],
        "Specialty": ["GoPro Hero 12", "DJI Mavic 3 Cine (Drone)", "Phantom Flex4K (High Speed)", "Thermal Camera", "CCTV Security", "Electron Microscope"]
    },
    "Lens": {
        "Prime Lenses": ["14mm Ultra Wide", "24mm Wide", "35mm Classic", "50mm Standard", "85mm Portrait", "135mm Telephoto"],
        "Zoom Lenses": ["16-35mm Wide Zoom", "24-70mm Standard Zoom", "70-200mm Telephoto Zoom", "200-600mm Super Telephoto"],
        "Cinematic": ["Anamorphic 2x", "Cooke S4/i", "Zeiss Master Prime", "Vintage K35"],
        "Special Effects": ["Fisheye 8mm", "Macro 100mm", "Tilt-Shift", "Split Diopter", "Kaleidoscope Filter", "Star Filter"]
    },
    "Lighting": {
        "Natural": ["Golden Hour", "Blue Hour", "Overcast Soft", "Direct Sunlight", "Dappled Light", "Moonlight", "Bioluminescence"],
        "Studio": ["Three-Point Setup", "Rembrandt Lighting", "Butterfly Lighting", "Softbox", "Beauty Dish", "Rim Lighting", "Ring Light"],
        "Atmospheric": ["Volumetric Fog", "God Rays", "Haze", "Smoke", "Lens Flares", "Caustics (Water Refraction)"],
        "Artistic": ["Neon Cyberpunk", "Chiaroscuro", "Silhouette", "Double Exposure", "Blacklight UV", "Strobe/Flash"]
    },
    "Film Stock": {
        "Color Negative": ["Kodak Portra 160", "Kodak Portra 400", "Kodak Portra 800", "Kodak Ektar 100", "Fujifilm Pro 400H", "CineStill 800T"],
        "Black & White": ["Kodak Tri-X 400", "Ilford HP5 Plus", "Ilford Delta 3200", "Agfa APX 100", "Fujifilm Neopan"],
        "Slide/Reversal": ["Fujifilm Velvia 50", "Fujifilm Provia 100F", "Kodachrome 64 (Vintage)", "Ektachrome E100"],
        "Instant/Lo-Fi": ["Polaroid 600", "Instax Mini", "Expired Film", "Wet Plate Collodion", "Tintype"]
    },
    "Composition": {
        "Framing": ["Rule of Thirds", "Golden Ratio", "Center Framed", "Symmetrical", "Frame within Frame", "Negative Space"],
        "Perspective": ["One-Point Perspective", "Leading Lines", "Vanishing Point", "Forced Perspective", "Isometric"],
        "Angles": ["Eye Level", "Low Angle (Hero)", "High Angle (Vulnerable)", "Dutch Angle (Unease)", "Over-the-Shoulder", "Bird's Eye", "Worm's Eye"],
        "Depth": ["Shallow Depth of Field", "Deep Focus", "Foreground Interest", "Layered Composition", "Bokeh Background"]
    },
    "Medium": {
        "Photography": ["Digital Photography", "Analog Photography", "Editorial", "Photojournalism", "Macro Photography", "Astrophotography"],
        "Traditional Art": ["Oil Painting", "Watercolor", "Acrylic", "Charcoal Sketch", "Ink Illustration", "Pencil Drawing", "Pastel"],
        "Digital Art": ["3D Render (Octane)", "Unreal Engine 5", "Concept Art", "Matte Painting", "Vector Art", "Pixel Art", "Voxel Art"],
        "Craft": ["Claymation", "Paper Cutout", "Origami", "Stained Glass", "Mosaic", "Wood Carving", "Embroidery"]
    },
    "Style": {
        "Futuristic": ["Cyberpunk", "Sci-Fi", "Space Opera", "Solarpunk", "High-Tech", "Post-Human"],
        "Retro/Vintage": ["Steampunk", "Dieselpunk", "Retro 80s", "Synthwave", "Vaporwave", "Art Deco", "Mid-Century Modern"],
        "Artistic Movements": ["Surrealism", "Impressionism", "Cubism", "Pop Art", "Abstract Expressionism", "Minimalism", "Bauhaus"],
        "Thematic": ["Noir", "Gothic", "Fantasy", "Grimdark", "Whimsical", "Cottagecore", "Psychedelic"]
    },
    "Color": {
        "Schemes": ["Monochromatic", "Analogous", "Complementary", "Split-Complementary", "Triadic", "Tetradic"],
        "Palettes": ["Teal and Orange", "Cyberpunk Neon", "Pastel", "Earth Tones", "Black & White", "Sepia", "Vibrant/Saturated"],
        "Characteristics": ["High Contrast", "Low Contrast", "Muted/Desaturated", "Color Graded", "Technicolor", "Cross-Processed"],
        "Effects": ["Iridescent", "Metallic", "Glossy", "Matte", "Fluorescent", "Infrared"]
    },
    "Fashion": {
        "High Fashion": ["Haute Couture", "Avant-Garde", "Runway", "Met Gala Style", "Editorial Fashion"],
        "Street/Urban": ["Streetwear", "Techwear", "Athleisure", "Hip-Hop Style", "Skater Style", "Cyber-Goth"],
        "Historical": ["Victorian", "Edwardian", "Roaring 20s", "Medieval Armor", "Renaissance", "1950s Pin-up"],
        "Sci-Fi/Fantasy": ["Cybernetic Armor", "Space Suit", "Steampunk Attire", "Elven Robes", "Post-Apocalyptic Rags"]
    },
    "Architecture": {
        "Modern": ["Modernist", "Brutalist", "Bauhaus", "Minimalist Concrete", "Glass Skyscraper", "Parametric Design"],
        "Historical": ["Gothic Revival", "Art Deco", "Neo-Classical", "Victorian Mansion", "Ancient Roman", "Traditional Japanese"],
        "Futuristic": ["Cyberpunk Cityscape", "Arcology", "Space Station Interior", "Floating City", "Underwater Dome", "Biophilic Design"],
        "Vernacular": ["Log Cabin", "Mediterranean Villa", "Industrial Loft", "Suburban House", "Nomadic Tent"]
    },
    "Texture": {
        "Surface": ["Rough Concrete", "Polished Metal", "Smooth Plastic", "Cracked Mud", "Rusty Iron", "Weathered Wood", "Marble"],
        "Fabric": ["Silk", "Velvet", "Denim", "Leather", "Latex", "Linen", "Wool Knit"],
        "Visual Noise": ["Film Grain", "Digital Noise", "Glitch Artifacts", "Halftone Pattern", "Scanlines", "Pixelated"],
        "Organic": ["Fur", "Scales", "Feathers", "Skin Pores", "Slime", "Mossy"]
    },
    "View": {
        "Camera Distance": ["Extreme Close-up", "Close-up", "Medium Shot", "Full Shot", "Wide Shot", "Extreme Wide Shot"],
        "Aerial": ["Drone View", "Satellite View", "Bird's Eye", "Orbital View"],
        "Technical": ["Isometric", "Orthographic", "Cutaway", "Cross-Section", "Blueprint", "Schematic"],
        "Perspective": ["First-Person (POV)", "Third-Person", "Selfie", "Telescopic", "Microscopic"]
    },
    "Engine": {
        "Real-Time": ["Unreal Engine 5", "Unity HDRP", "CryEngine", "Godot", "Source Engine"],
        "Ray Tracing": ["Blender Cycles", "Octane Render", "Redshift", "Arnold", "V-Ray", "Corona Renderer"],
        "Stylized": ["Cel Shaded", "Toon Shader", "Pixel Shader", "Wireframe Render"],
        "Modeling": ["ZBrush Sculpt", "CAD Model", "Photogrammetry", "Procedural Generation"]
    },
    "Era": {
        "Ancient": ["Prehistoric", "Stone Age", "Bronze Age", "Ancient Egypt", "Ancient Greece", "Roman Empire"],
        "History": ["Medieval", "Renaissance", "Victorian Era", "Wild West", "Industrial Revolution", "Roaring 20s"],
        "20th Century": ["1950s Atomic Age", "1960s Psychedelic", "1970s Disco", "1980s Retro", "1990s Grunge", "Y2K Aesthetic"],
        "Future": ["Near Future", "Cyberpunk 2077", "Post-Apocalyptic", "Space Age", "Futuristic 3000"]
    },
    "Mood": {
        "Positive": ["Happy", "Joyful", "Peaceful", "Romantic", "Whimsical", "Energetic", "Triumphant"],
        "Negative": ["Melancholic", "Depressing", "Lonely", "Tense", "Anxious", "Angry", "Chaotic"],
        "Atmospheric": ["Mysterious", "Ethereal", "Dreamy", "Nostalgic", "Spiritual", "Zen"],
        "Genre": ["Horror", "Thriller", "Epic", "Dramatic", "Cinematic", "Intimate"]
    },
    "Environment": {
        "Nature": ["Deep Forest", "Tropical Beach", "Arctic Tundra", "Desert Dunes", "Mountain Peak", "Underwater Coral Reef"],
        "Urban": ["Cyber City", "New York Streets", "Tokyo Neon", "Industrial District", "Subway Station", "Rooftop"],
        "Indoor": ["Cozy Bedroom", "Futuristic Laboratory", "Ancient Library", "Messy Kitchen", "Minimalist Office", "Art Gallery"],
        "Fantastic": ["Alien Planet", "Floating Island", "Dungeon", "Magic School", "Cloud Kingdom", "Hellscape"]
    },
    "Material": {
        "Solid": ["Gold", "Silver", "Bronze", "Chrome", "Obsidian", "Diamond", "Crystal"],
        "Fluid": ["Water", "Lava", "Slime", "Liquid Metal", "Oil", "Paint", "Blood"],
        "Gas": ["Smoke", "Steam", "Fog", "Fire", "Plasma", "Neon Gas", "Clouds"],
        "Synthetic": ["Carbon Fiber", "Plastic", "Rubber", "Glass", "Aerogel", "Hologram"]
    },
    "Weather": {
        "Clear": ["Sunny", "Clear Night", "Starry Sky", "Heatwave", "Dry"],
        "Precipitation": ["Rainy", "Drizzle", "Downpour", "Snowy", "Blizzard", "Hail", "Sleet"],
        "Atmosphere": ["Foggy", "Misty", "Hazy", "Smoggy", "Dusty"],
        "Extreme": ["Thunderstorm", "Tornado", "Hurricane", "Sandstorm", "Aurora Borealis", "Meteor Shower"]
    },
    "Movement": {
        "Speed": ["Static", "Slow Motion", "Hyperlapse", "High Speed", "Frozen in Time"],
        "Style": ["Motion Blur", "Long Exposure", "Light Trails", "Ghosting", "Speed Lines"],
        "Action": ["Running", "Flying", "Falling", "Exploding", "Dancing", "Fighting", "Swimming"],
        "Physics": ["Floating", "Melting", "Shattering", "Disintegrating", "Morphing", "Flowing"]
    },
    "Post-Process": {
        "Optical": ["Vignette", "Chromatic Aberration", "Lens Distortion", "Bloom", "Bokeh", "Lens Flare"],
        "Color": ["Color Graded", "Cross-Process", "Bleach Bypass", "Technicolor", "Sepia Tone", "Desaturated"],
        "Texture": ["Film Grain", "Noise", "Scratches", "Dust", "VHS Artifacts", "Glitch"],
        "Artistic": ["Halftone", "Pixelate", "Posterize", "Oil Paint Filter", "Sketch Filter", "Double Exposure"]
    }
};
