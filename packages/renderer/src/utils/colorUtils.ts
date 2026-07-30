/**
 * Parses a variety of color string formats (hex, names, name + hex combinations)
 * into a valid CSS hex code and a human-readable label.
 */
export function parseColor(colorStr: string): { hex: string; label: string } {
    if (!colorStr) return { hex: '#000000', label: 'Black' };
    
    // Trim and clean
    const cleanStr = colorStr.trim();
    
    // Check if it's already a clean hex code
    if (/^#[0-9A-Fa-f]{6}$/.test(cleanStr)) {
        return { hex: cleanStr, label: cleanStr };
    }
    if (/^#[0-9A-Fa-f]{3}$/.test(cleanStr)) {
        // Expand 3-char hex to 6-char hex
        const expanded = '#' + cleanStr[1] + cleanStr[1] + cleanStr[2] + cleanStr[2] + cleanStr[3] + cleanStr[3];
        return { hex: expanded, label: cleanStr };
    }
    
    // Extract hex from string like "Midnight Shadow (#0F172A)" or "Midnight Shadow #0F172A"
    const hexMatch = cleanStr.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/);
    if (hexMatch) {
        let hex = hexMatch[0];
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        // Label is the string without the hex code part
        const label = cleanStr.replace(/[([-]?#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})[)]?/, '').trim();
        return { hex, label: label || cleanStr };
    }
    
    // Standard CSS color name check (only if window/document is defined)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
            const tempElement = document.createElement('div');
            tempElement.style.color = cleanStr;
            // The CSSOM silently rejects invalid color values and leaves style.color
            // empty — that's the only reliable validity check. Checking the *computed*
            // color instead (the old approach) is a false-positive trap: an unset
            // color inherits the ambient text color, and in this app's dark theme
            // that's near-white, not black — so every made-up name (e.g. an
            // AI-generated "Golden Hour Amber" with no hex attached) silently passed
            // as "valid" and resolved to white instead of falling through to the
            // name-map/hash fallback below.
            const isRecognizedColorName = tempElement.style.color !== '';
            let computedColor = '';
            if (isRecognizedColorName) {
                document.body.appendChild(tempElement);
                computedColor = window.getComputedStyle(tempElement).color;
                document.body.removeChild(tempElement);
            }

            if (isRecognizedColorName && computedColor && !computedColor.includes('canvas')) {
                // Convert rgb/rgba to hex
                const rgb = computedColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const hex = '#' + rgb.slice(0, 3).map(x => {
                        const hexVal = parseInt(x).toString(16);
                        return hexVal.length === 1 ? '0' + hexVal : hexVal;
                    }).join('');
                    return { hex, label: cleanStr };
                }
            }
        } catch {
            // Silently fall back
        }
    }
    
    // Map some popular creative names to hex fallbacks
    const popularCreativeColors: Record<string, string> = {
        'midnight shadow': '#0b0c10',
        'midnight': '#0b0c10',
        'forest green': '#22c55e',
        'crimson': '#dc2626',
        'neon pink': '#ff007f',
        'electric blue': '#0070f3',
        'cyberpunk yellow': '#fcd34d',
        'synthwave purple': '#8b5cf6',
        'sunset orange': '#f97316',
        'gold': '#d97706',
        'silver': '#94a3b8',
        'charcoal': '#334155',
        'sakura pink': '#fbcfe8',
    };
    
    const key = cleanStr.toLowerCase();
    if (popularCreativeColors[key]) {
        return { hex: popularCreativeColors[key], label: cleanStr };
    }
    
    // Deterministic fallback based on hash of string
    let hash = 0;
    for (let i = 0; i < cleanStr.length; i++) {
        hash = cleanStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    let hex = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff;
        const component = value.toString(16);
        hex += component.length === 1 ? '0' + component : component;
    }
    
    return { hex, label: cleanStr };
}
