import { deploySite } from '@remotion/cloudrun';
import path from 'path';

/**
 * Deploy the Remotion bundle to Google Cloud Storage for Cloud Run rendering.
 *
 * This uploads all registered compositions (VideoProject, LogoReveal variants,
 * BannerAnimations) to GCS so that renderMediaOnCloudrun() can reference them
 * via the serveUrl/siteName.
 *
 * Prerequisites:
 *   - Google Application Default Credentials must be configured:
 *       `gcloud auth application-default login`
 *     OR set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path.
 *   - The Cloud Run service must already be deployed:
 *       `npx remotion cloudrun services deploy`
 *
 * Usage:
 *   npx tsx scripts/deploy-cloudrun.ts
 */
const deploy = async () => {
    const region = process.env.VITE_REMOTION_GCP_REGION || 'us-east1';

    console.log('🎬 Deploying Remotion Cloud Run site bundle to GCS...');
    console.log(`   Region: ${region}`);

    // Entry point: packages/renderer/src/remotion/index.ts
    // This file calls registerRoot(RemotionRoot) with the canonical Root.tsx
    // that contains ALL compositions (VideoProject, LogoReveal, Banners).
    const entryPoint = path.resolve(
        process.cwd(),
        'packages/renderer/src/remotion/index.ts'
    );

    // siteName MUST match VITE_REMOTION_SITE_NAME in .env / RenderService.ts
    // Default: 'indii-os-remotion-site'
    const siteName = process.env.VITE_REMOTION_SITE_NAME || 'indii-os-remotion-site';

    const { serveUrl, siteName: deployedSiteName } = await deploySite({
        entryPoint,
        siteName,
        region,
    });

    console.log(`\n✅ Deployed site to GCS: ${serveUrl}`);
    console.log(`   Site name: ${deployedSiteName}`);
    console.log(`   Set VITE_REMOTION_SITE_NAME="${deployedSiteName}" in your .env if not already present.`);
};

deploy().catch((err) => {
    console.error('❌ Cloud Run site deploy failed:', err);
    process.exit(1);
});
