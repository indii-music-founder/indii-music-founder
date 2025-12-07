const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
  hooks: {
    // Re-sign after FusesPlugin modifies binaries (fixes code signature invalidation)
    postPackage: async (_config, options) => {
      if (process.platform !== 'darwin') return;

      // Find the .app bundle in the output directory
      const outputDir = options.outputPaths[0];
      const apps = fs.readdirSync(outputDir).filter(f => f.endsWith('.app'));

      if (apps.length === 0) {
        console.error('Warning: No .app bundle found to sign');
        return;
      }

      const appPath = path.join(outputDir, apps[0]);
      console.log(`Re-signing ${appPath} after fuse modifications...`);

      try {
        execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
        console.log('Ad-hoc signing complete.');
      } catch (err) {
        console.error('Warning: Ad-hoc signing failed:', err.message);
      }
    }
  },
  packagerConfig: {
    asar: {
      integrity: true // Enforces integrity checksums on the archive (Tamper Resistance)
    },
    // Exclude server-side code from Electron bundle
    ignore: (path) => {
      // Directories to exclude
      const excludeDirs = [
        '/functions',
        '/landing-page',
        '/e2e',
        '/docs',
        '/.github',
        '/.agent',
        '/out',
        '/.git'
      ];
      return excludeDirs.some(dir => path.startsWith(dir));
    },
    // macOS Signing handled in postPackage hook (after FusesPlugin modifies binaries)
    // For production with Developer ID cert, uncomment and set identity:
    // osxSign: { identity: 'Developer ID Application: Your Name (TEAM_ID)' },
    // macOS Notarization
    // macOS Notarization (Apple Hardened Runtime)
    osxNotarize: process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD ? {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    } : undefined,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Windows EV/Cloud Signing (Req. June 2023)
        // Uses Azure Trusted Signing or Hardware Token
        windowsSign: process.env.WINDOWS_SIGN_PARAMS ? {
          signWithParams: process.env.WINDOWS_SIGN_PARAMS,
        } : undefined
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    // DMG maker disabled - appdmg native build fails with paths containing spaces
    // To enable: move project to path without spaces, then run: npm install --save-dev appdmg
    // {
    //   name: '@electron-forge/maker-dmg',
    //   config: {
    //     format: 'ULFO'
    //   }
    // }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Electron Fuses (Binary Locking for HEY Audit)
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,            // HEY Finding #15: Disables NODE_RUN (prevents starting as Node process)
      [FuseV1Options.EnableCookieEncryption]: true, // HEY Finding #10: Protects cookies on disk
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // HEY Finding #15: Blocks NODE_OPTIONS injection
      [FuseV1Options.EnableNodeCliInspectArguments]: false,        // HEY Finding #15: Prevents --inspect (debugging)
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, // Enforces ASAR Integrity (Tamper Resistance)
      [FuseV1Options.OnlyLoadAppFromAsar]: true,                   // Forces app to run from signed bundle
    }),
  ],
};
