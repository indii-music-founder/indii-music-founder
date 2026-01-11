#!/usr/bin/env node
/**
 * Generate PWA Icons from SVG
 *
 * This script converts the source SVG logo to required PWA icon sizes.
 *
 * Requirements:
 *   - sharp (npm install --save-dev sharp)
 *   OR
 *   - ImageMagick (system installation)
 *
 * Usage:
 *   node scripts/generate-pwa-icons.js
 *   OR
 *   npm run generate:icons
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SOURCE_SVG = path.join(__dirname, '../public/indiiOS-logo.svg');
const OUTPUT_DIR = path.join(__dirname, '../public');

const ICONS = [
  { name: 'icon-192.png', size: 192, description: 'PWA icon 192x192 (maskable)' },
  { name: 'icon-512.png', size: 512, description: 'PWA icon 512x512 (maskable)' },
  { name: 'apple-touch-icon.png', size: 180, description: 'Apple touch icon 180x180' },
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkSourceExists() {
  if (!fs.existsSync(SOURCE_SVG)) {
    log(`❌ Error: Source file not found: ${SOURCE_SVG}`, 'red');
    log('\nPlease ensure public/indiiOS-logo.svg exists.', 'yellow');
    process.exit(1);
  }
}

function trySharp() {
  try {
    const sharp = require('sharp');
    return sharp;
  } catch {
    return null;
  }
}

function checkImageMagick() {
  try {
    execSync('magick --version', { stdio: 'ignore' });
    return 'magick';
  } catch {
    try {
      execSync('convert --version', { stdio: 'ignore' });
      return 'convert';
    } catch {
      return null;
    }
  }
}

async function generateWithSharp(sharp) {
  log('🎨 Using Sharp for image generation...', 'blue');
  log('', 'reset');

  for (const icon of ICONS) {
    const outputPath = path.join(OUTPUT_DIR, icon.name);
    log(`   Generating ${icon.name} (${icon.size}x${icon.size})...`, 'yellow');

    try {
      await sharp(SOURCE_SVG)
        .resize(icon.size, icon.size)
        .png()
        .toFile(outputPath);

      log(`   ✅ Created: ${icon.name}`, 'green');
    } catch (error) {
      log(`   ❌ Failed: ${icon.name} - ${error.message}`, 'red');
    }
  }
}

function generateWithImageMagick(command) {
  log(`🎨 Using ImageMagick (${command}) for image generation...`, 'blue');
  log('', 'reset');

  for (const icon of ICONS) {
    const outputPath = path.join(OUTPUT_DIR, icon.name);
    log(`   Generating ${icon.name} (${icon.size}x${icon.size})...`, 'yellow');

    try {
      execSync(
        `${command} "${SOURCE_SVG}" -resize ${icon.size}x${icon.size} -background transparent "${outputPath}"`,
        { stdio: 'ignore' }
      );
      log(`   ✅ Created: ${icon.name}`, 'green');
    } catch (error) {
      log(`   ❌ Failed: ${icon.name} - ${error.message}`, 'red');
    }
  }
}

function showHelp() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('  PWA Icon Generator - Installation Required', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('\nNo image processing tool found.', 'red');
  log('\nPlease install one of the following:\n', 'yellow');
  log('Option 1: Sharp (Node.js)', 'blue');
  log('  npm install --save-dev sharp\n', 'reset');
  log('Option 2: ImageMagick (System)', 'blue');
  log('  macOS:   brew install imagemagick', 'reset');
  log('  Ubuntu:  sudo apt-get install imagemagick', 'reset');
  log('  Windows: https://imagemagick.org/script/download.php\n', 'reset');
  log('Option 3: Use Online Generator', 'blue');
  log('  https://progressier.com/pwa-icons-and-ios-splash-screen-generator\n', 'reset');
  log('Option 4: Use Shell Script', 'blue');
  log('  ./scripts/generate-pwa-icons.sh\n', 'reset');
  process.exit(1);
}

function validateIcons() {
  log('\n🔍 Validating generated icons...', 'yellow');

  for (const icon of ICONS) {
    const iconPath = path.join(OUTPUT_DIR, icon.name);
    if (fs.existsSync(iconPath)) {
      const stats = fs.statSync(iconPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      log(`   ✓ ${icon.name} - ${sizeKB} KB`, 'green');
    } else {
      log(`   ✗ ${icon.name} - NOT FOUND`, 'red');
    }
  }
}

function showMaskableInfo() {
  log('\n📐 Maskable Safe Area Guide:', 'yellow');
  log('   192px icon: Keep content within 154x154 center (80%)');
  log('   512px icon: Keep content within 410x410 center (80%)');
  log('\n   Test at: https://maskable.app/editor\n');
}

async function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('  PWA Icon Generator for indiiOS', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('', 'reset');

  // Check source file exists
  checkSourceExists();

  log(`📁 Source: ${path.relative(process.cwd(), SOURCE_SVG)}`, 'yellow');
  log(`📁 Output: ${path.relative(process.cwd(), OUTPUT_DIR)}`, 'yellow');
  log('', 'reset');

  // Try Sharp first (faster, better quality)
  const sharp = trySharp();
  if (sharp) {
    await generateWithSharp(sharp);
  } else {
    // Fallback to ImageMagick
    const magickCommand = checkImageMagick();
    if (magickCommand) {
      generateWithImageMagick(magickCommand);
    } else {
      // No tools available
      showHelp();
      return;
    }
  }

  // Validate generated icons
  validateIcons();

  // Show maskable info
  showMaskableInfo();

  log('🎉 Done! Icons ready for PWA deployment.\n', 'green');
}

// Run the script
main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
