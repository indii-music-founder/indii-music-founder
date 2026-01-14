# 🎨 Generate PWA Icons - Required Step

## ⚠️ Action Required

The PWA manifest references 3 icon files that **must be generated before deployment**:

- `public/icon-192.png` (192×192px, maskable)
- `public/icon-512.png` (512×512px, maskable)
- `public/apple-touch-icon.png` (180×180px)

**Source logo provided:** `public/indiiOS-logo.svg`

---

## 🚀 Quick Start (Choose One)

### Option 1: Automated Script (Recommended)

**Requirements:** ImageMagick or Sharp

```bash
# Install ImageMagick first:
# macOS:   brew install imagemagick
# Ubuntu:  sudo apt-get install imagemagick
# Windows: https://imagemagick.org/script/download.php

# Then run:
npm run generate:icons

# Or directly:
./scripts/generate-pwa-icons.sh
```

### Option 2: Install Sharp (Node.js)

```bash
npm install --save-dev sharp
npm run generate:icons
```

### Option 3: Online Generator (No Installation)

1. Visit: https://progressier.com/pwa-icons-and-ios-splash-screen-generator
2. Upload `public/indiiOS-logo.svg`
3. Download generated icons
4. Move to `public/` directory:
   - `icon-192.png`
   - `icon-512.png`
   - `apple-touch-icon.png`

### Option 4: Manual Design Tool

Use Figma, Photoshop, or any image editor:

1. Open `public/indiiOS-logo.svg`
2. Export as PNG:
   - **192×192px** → `icon-192.png` (with 20% padding for maskable)
   - **512×512px** → `icon-512.png` (with 20% padding for maskable)
   - **180×180px** → `apple-touch-icon.png`
3. Save to `public/` directory

---

## 📐 Maskable Icon Requirements

Maskable icons need **20% safe area padding** on all sides:

```
┌─────────────────────────┐
│                         │  ← Full canvas (512×512)
│   ┌─────────────────┐   │
│   │                 │   │  ← Safe area (410×410, 80%)
│   │   KEEP LOGO     │   │     Content must fit here
│   │   IN THIS AREA  │   │
│   └─────────────────┘   │
│                         │
└─────────────────────────┘
```

**Safe area sizes:**
- 192px → 154px safe area (77px padding each side)
- 512px → 410px safe area (51px padding each side)

**Test your icons:** https://maskable.app/editor

---

## ✅ Verify Icons

After generation, verify files exist:

```bash
ls -lh public/icon-*.png public/apple-touch-icon.png
```

Expected output:
```
-rw-r--r-- 1 user user  15K  icon-192.png
-rw-r--r-- 1 user user  45K  icon-512.png
-rw-r--r-- 1 user user  12K  apple-touch-icon.png
```

Test in browser:
- Visit: `http://localhost:4242/icon-192.png`
- Visit: `http://localhost:4242/icon-512.png`
- Visit: `http://localhost:4242/apple-touch-icon.png`

All should display the indiiOS logo.

---

## 🐛 Troubleshooting

### "ImageMagick not found"
Install ImageMagick:
- macOS: `brew install imagemagick`
- Ubuntu: `sudo apt-get install imagemagick`
- Windows: Download from https://imagemagick.org

### "Sharp module not found"
```bash
npm install --save-dev sharp
```

### "Scripts don't work"
Use the online generator (Option 3 above) - no installation required.

---

## 🎯 Next Steps After Generation

1. Verify icons created: `ls public/icon-*.png`
2. Start dev server: `npm run dev`
3. Test PWA install on mobile device
4. Deploy to production

---

**Once icons are generated, this file can be deleted.** ✅
