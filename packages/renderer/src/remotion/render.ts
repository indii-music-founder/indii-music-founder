import path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { logger } from '@/utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMP_ID = process.argv[2] || 'LogoReveal';
const OUTPUT_DIR = path.resolve(__dirname, '../../docs/assets');

async function render() {
  logger.info(`🎬 Bundling Remotion project...`);

  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, './index.ts'),
    webpackOverride: (config) => config,
  });

  logger.info(`📦 Bundle ready. Selecting composition "${COMP_ID}"...`);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: COMP_ID,
  });

  const outputPath = path.join(OUTPUT_DIR, `${COMP_ID}.mp4`);

  logger.info(`🎥 Rendering ${composition.width}x${composition.height} @ ${composition.fps}fps (${composition.durationInFrames} frames)...`);
  logger.info(`📂 Output: ${outputPath}`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
  });

  logger.info(`✅ Rendered: ${outputPath}`);
}

render().catch((err) => {
  logger.error('❌ Render failed:', err);
  process.exit(1);
});
