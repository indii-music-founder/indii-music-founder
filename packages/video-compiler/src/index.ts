/**
 * @indii/video-compiler — the framework-neutral IndiiVideoProject → composition
 * compiler (MIG-008, ADR-001).
 *
 * Pure TypeScript with zero runtime dependencies beyond @indii/shared, so every
 * executor can share one translation layer: the Electron main process (local
 * renders), the web renderer (browser-side compilation), and the cloud render
 * worker (server-side composition).
 */
export * from './compiler.js';
