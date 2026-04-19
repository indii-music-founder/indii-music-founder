// Module-local Remotion entry point
//
// NOTE: This file is intentionally NOT used by the Cloud Run deployment bundle.
// The canonical entry point is packages/renderer/src/remotion/index.ts which
// registers all compositions via RemotionRoot. This module-local index exists
// only to re-export the composition component for in-app consumption.
//
// DO NOT add registerRoot() here — it would cause duplicate registration errors
// if both entry points were ever loaded in the same bundle.

export { MyComposition } from './MyComposition';
export { RemotionRoot } from '../../../remotion/Root';
