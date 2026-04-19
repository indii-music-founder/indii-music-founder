import { registerRoot } from 'remotion';

// Import from the canonical Root.tsx which contains ALL compositions:
// - VideoProject (with calculateMetadata for dynamic resolution)
// - LogoReveal (landscape, square, vertical)
// - BannerAnimations (Cinematic, ZoomThrough, Orbit, Glitch, Pulse)
//
// The previous module-local Root.tsx only registered "MyComp" — a stale
// single-composition entry that was missing the full registry.
import { RemotionRoot } from '../../../remotion/Root';

registerRoot(RemotionRoot);
