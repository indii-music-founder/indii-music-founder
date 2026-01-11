#!/bin/bash
#
# Generate PWA Icons from SVG
# Requires: ImageMagick (install with: brew install imagemagick)
#
# Usage: ./scripts/generate-pwa-icons.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PWA Icon Generator for indiiOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check for ImageMagick
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo -e "${RED}❌ Error: ImageMagick not found${NC}"
    echo ""
    echo "Please install ImageMagick:"
    echo ""
    echo "  macOS:   brew install imagemagick"
    echo "  Ubuntu:  sudo apt-get install imagemagick"
    echo "  Windows: https://imagemagick.org/script/download.php"
    echo ""
    exit 1
fi

# Determine correct command (magick or convert)
if command -v magick &> /dev/null; then
    CONVERT="magick"
else
    CONVERT="convert"
fi

# Source SVG
SOURCE_SVG="public/indiiOS-logo.svg"

# Check if source exists
if [ ! -f "$SOURCE_SVG" ]; then
    echo -e "${RED}❌ Error: Source file not found: $SOURCE_SVG${NC}"
    echo ""
    echo "Please ensure public/indiiOS-logo.svg exists."
    exit 1
fi

# Output directory
OUTPUT_DIR="public"

echo -e "${YELLOW}📁 Source: $SOURCE_SVG${NC}"
echo -e "${YELLOW}📁 Output: $OUTPUT_DIR/${NC}"
echo ""

# Generate icon-192.png (192x192, maskable)
echo -e "${BLUE}🎨 Generating icon-192.png (192x192, maskable)...${NC}"
$CONVERT "$SOURCE_SVG" -resize 192x192 -background transparent "$OUTPUT_DIR/icon-192.png"
echo -e "${GREEN}✅ Created: icon-192.png${NC}"

# Generate icon-512.png (512x512, maskable)
echo -e "${BLUE}🎨 Generating icon-512.png (512x512, maskable)...${NC}"
$CONVERT "$SOURCE_SVG" -resize 512x512 -background transparent "$OUTPUT_DIR/icon-512.png"
echo -e "${GREEN}✅ Created: icon-512.png${NC}"

# Generate apple-touch-icon.png (180x180)
echo -e "${BLUE}🎨 Generating apple-touch-icon.png (180x180)...${NC}"
$CONVERT "$SOURCE_SVG" -resize 180x180 -background transparent "$OUTPUT_DIR/apple-touch-icon.png"
echo -e "${GREEN}✅ Created: apple-touch-icon.png${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ All icons generated successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Show file sizes
echo -e "${YELLOW}📊 File sizes:${NC}"
ls -lh "$OUTPUT_DIR"/icon-*.png "$OUTPUT_DIR"/apple-touch-icon.png | awk '{print "   "$9" - "$5}'
echo ""

# Validate with file command
echo -e "${YELLOW}🔍 Validation:${NC}"
for icon in "$OUTPUT_DIR/icon-192.png" "$OUTPUT_DIR/icon-512.png" "$OUTPUT_DIR/apple-touch-icon.png"; do
    if [ -f "$icon" ]; then
        dimensions=$(file "$icon" | grep -o '[0-9]* x [0-9]*')
        echo -e "   ${GREEN}✓${NC} $(basename "$icon"): $dimensions"
    else
        echo -e "   ${RED}✗${NC} $(basename "$icon"): NOT FOUND"
    fi
done
echo ""

# Check maskable safe area
echo -e "${YELLOW}📐 Maskable Safe Area Guide:${NC}"
echo "   192px icon: Keep content within 154x154 center (80%)"
echo "   512px icon: Keep content within 410x410 center (80%)"
echo ""
echo "   Test at: https://maskable.app/editor"
echo ""

echo -e "${GREEN}🎉 Done! Icons ready for PWA deployment.${NC}"
echo ""
