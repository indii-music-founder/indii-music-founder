# PWA Icon Assets - Setup Instructions

## Missing Icons

The PWA manifest references 3 icon files that need to be created:

1. **icon-192.png** (192x192px, maskable)
2. **icon-512.png** (512x512px, maskable)
3. **apple-touch-icon.png** (180x180px)

## Icon Requirements

### Maskable Icons (icon-192.png, icon-512.png)
- **Safe area:** Content must fit within 80% center circle
- **Full bleed:** Background extends to edges
- **Purpose:** Works with shaped icon masks (Android adaptive icons)
- **Format:** PNG with transparency or solid background

### Apple Touch Icon (apple-touch-icon.png)
- **Size:** 180x180px
- **Format:** PNG (no transparency needed, Apple adds rounded corners)
- **Background:** Solid color recommended

## Quick Solutions

### Option 1: Use Existing Favicon/Logo (Fastest)
If you have `public/vite.svg` or another logo:

```bash
# Install ImageMagick (if not already)
brew install imagemagick  # macOS
# or: sudo apt-get install imagemagick  # Linux

# Convert to required sizes
cd public

# Create 192x192 icon
magick convert vite.svg -resize 192x192 -background "#0f0f0f" -flatten icon-192.png

# Create 512x512 icon
magick convert vite.svg -resize 512x512 -background "#0f0f0f" -flatten icon-512.png

# Create Apple touch icon
magick convert vite.svg -resize 180x180 -background "#0f0f0f" -flatten apple-touch-icon.png
```

### Option 2: Online PWA Icon Generator (Easiest)
Use these free tools:

1. **PWA Asset Generator** - https://progressier.com/pwa-icons-and-ios-splash-screen-generator
   - Upload your logo
   - Auto-generates all required sizes
   - Includes maskable safe area

2. **RealFaviconGenerator** - https://realfavicongenerator.net/
   - Comprehensive PWA icon generator
   - iOS, Android, Windows support
   - Download zip with all assets

3. **Maskable.app** - https://maskable.app/editor
   - Test and create maskable icons
   - Visual safe area preview
   - Export in all sizes

### Option 3: Design Software Export
If you have Figma, Sketch, or Adobe tools:

**Figma:**
1. Create 512x512 artboard
2. Add your logo centered (80% of canvas = 410x410 safe area)
3. File → Export → PNG @ 1x for 512x512
4. File → Export → PNG @ 0.375x for 192x192
5. File → Export → PNG @ 0.352x for 180x180

**Photoshop:**
1. New document 512x512px
2. Add logo with 51px padding on all sides (safe area)
3. Export → Export As → PNG
4. Image → Image Size to resize for other variants

### Option 4: Use Default Placeholder (Temporary)
Create simple colored squares as placeholders:

```bash
cd public

# Create colored squares (requires ImageMagick)
magick -size 192x192 xc:"#6366f1" icon-192.png
magick -size 512x512 xc:"#6366f1" icon-512.png
magick -size 180x180 xc:"#6366f1" apple-touch-icon.png

# Add text label (optional)
magick icon-192.png -gravity center -pointsize 48 -fill white -annotate +0+0 "indiiOS" icon-192.png
```

## Maskable Icon Safe Area Guide

```
┌─────────────────────────┐
│                         │  ← Full canvas (512x512)
│   ┌─────────────────┐   │
│   │                 │   │  ← Safe area (410x410, 80%)
│   │                 │   │     Keep logo here
│   │      LOGO       │   │
│   │                 │   │
│   └─────────────────┘   │
│                         │
└─────────────────────────┘
```

**Formula:** Safe area = Canvas size × 0.8
- 192px → 154px safe area
- 512px → 410px safe area

## Validation Checklist

After creating icons:

- [ ] Files exist in `public/` directory
- [ ] File names match manifest.json exactly
- [ ] Sizes correct: 192x192, 512x512, 180x180
- [ ] Format is PNG
- [ ] 192 & 512 icons have 20% padding (maskable safe area)
- [ ] Apple icon has solid background (no transparency)
- [ ] Test in browser: view files at `/icon-192.png`, etc.

## Testing Maskable Icons

1. Visit https://maskable.app/editor
2. Upload your icon-192.png or icon-512.png
3. Toggle different mask shapes
4. Verify logo stays visible in all shapes

## Quick Check Commands

```bash
# Verify files exist
ls -lh public/icon-*.png public/apple-touch-icon.png

# Check file sizes (should be reasonable, < 50KB each)
du -h public/icon-*.png public/apple-touch-icon.png

# Verify image dimensions
file public/icon-192.png
file public/icon-512.png
file public/apple-touch-icon.png
```

## Recommended Icon Design

For **indiiOS branding:**
- Background: `#0f0f0f` (matches theme)
- Logo/Text: White or `#6366f1` (neon blue)
- Style: Modern, clean, recognizable at small sizes
- Include app name or logo mark

## Temporary Workaround

If you need to deploy immediately without icons:

1. Copy `public/vite.svg` to the required names (browsers will handle SVG)
2. Or reference existing favicon in manifest
3. Or temporarily remove icon entries from manifest

## Need Help?

If you don't have design tools or a logo:
1. I can create an **SVG placeholder** you can convert to PNG
2. Hire on Fiverr (~$5-20 for simple icon set)
3. Use AI generators (DALL-E, Midjourney) to create logo
4. Use text-based logo maker (Canva, Looka)

---

**Priority:** Create these before deploying PWA to production.
**Timeline:** 15-30 minutes with online generators.
