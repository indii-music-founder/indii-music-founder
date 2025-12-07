const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: {
      integrity: true // Enforces integrity checksums on the archive (Tamper Resistance)
    },
    // macOS Signing
    osxSign: {},
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
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO'
      }
    }
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
