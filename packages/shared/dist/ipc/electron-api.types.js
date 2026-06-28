/**
 * @indii/shared — ElectronAPI IPC Type Contracts
 *
 * These interfaces define the complete IPC surface area exposed by the
 * Electron Main process via contextBridge.exposeInMainWorld('electronAPI', {...}).
 *
 * Consumed by:
 *   - packages/main/src/preload.ts (implementation)
 *   - packages/renderer/src/ (window.electronAPI usage in 57+ files)
 */
export {};
