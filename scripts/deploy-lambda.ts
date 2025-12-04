import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import path from 'path';
import { RemotionLambdaConfig } from '../remotion.lambda';

const deploy = async () => {
    const { region } = RemotionLambdaConfig;

    console.log('Deploying Remotion Lambda...');

    const { bucketName } = await getOrCreateBucket({ region });
    console.log(`Using bucket: ${bucketName}`);

    const { serveUrl } = await deploySite({
        bucketName,
        entryPoint: path.resolve(process.cwd(), 'src/modules/video/remotion/index.ts'),
        region,
        siteName: 'rndr-ai-video-studio',
    });

    console.log(`Deployed site to: ${serveUrl}`);
    console.log('Make sure to save this URL or configure your API to use it dynamically.');
};

deploy().catch(console.error);
