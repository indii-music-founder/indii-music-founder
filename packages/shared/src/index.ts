/**
 * @indiios/shared — Barrel export for shared types, IPC contracts, and schemas.
 *
 * This package has ZERO runtime dependencies. It exports only TypeScript
 * interfaces and Zod schemas consumed by packages/main and packages/renderer.
 */
export * from './ipc/electron-api.types';
export * from './types/ai.dto';
export * from './types/errors';
export * from './schemas/env.schema';
