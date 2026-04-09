Title: 🧪 Add tests for security ID generation

Description:
* 🎯 **What:** The `generateSecureId` and `generateSecureHex` functions in `packages/renderer/src/utils/security.ts` previously lacked tests. Since these rely on the `globalThis.crypto` object which behaves differently in various environments, tests were needed to ensure proper polyfilling or error throwing, as well as general validation.
* 📊 **Coverage:** Covered happy paths (default lengths, varying input lengths, prefixes), regex format validation (only valid hex characters are produced, IDs have the `[prefix]_[timestamp]_[hex]` format), and error handling (`crypto.getRandomValues` unavailable/missing).
* ✨ **Result:** Improved reliability and test coverage for the core `security.ts` utilities. Confirmed that the components correctly extract secure values and fallback via explicitly thrown errors when unsupported.
