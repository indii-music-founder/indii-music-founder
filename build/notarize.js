#!/usr/bin/env node

/**
 * Notarization Script for indiiOS Studio
 *
 * Notarizes macOS app builds with Apple's Developer ID
 * This is required for distribution outside the Mac App Store
 */

const { notarize } = require('@electron/notarize');
const path = require('path');

const APPLE_ID = process.env.APPLE_ID || 'YOUR_APPLE_ID';
const APPLE_ID_PASSWORD = process.env.APPLE_ID_PASSWORD;

async function notarizeApp() {
  console.log('Starting notarization...');

  try {
    await notarize({
      appBundlePath: path.join(process.cwd(), 'dist-electron-studio/indiiOS Studio.app'),
      appleId: APPLE_ID,
      appleIdPassword: APPLE_ID_PASSWORD,
      tool: 'notarytool',
      teamId: process.env.APPLE_TEAM_ID,
    });

    console.log('✓ Notarization successful!');
  } catch (error) {
    console.error('✗ Notarization failed:', error);
    process.exit(1);
  }
}

// Run notarization if this script is executed directly
if (require.main === module) {
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.error('Error: APPLE_ID and APPLE_ID_PASSWORD must be set as environment variables');
    process.exit(1);
  }

  notarizeApp();
}

module.exports = { notarizeApp };
