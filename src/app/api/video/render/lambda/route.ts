import { NextRequest, NextResponse } from 'next/server';
import { renderMediaOnLambda, getOrCreateBucket } from '@remotion/lambda';
import { RemotionLambdaConfig } from '../../../../../remotion.lambda';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project } = body;

        if (!project) {
            return NextResponse.json({ error: 'Project data is required' }, { status: 400 });
        }

        // In a real app, you'd probably want to deploy the site dynamically or use a fixed deployment.
        // For this implementation, we'll assume the site is already deployed and we know the serveUrl.
        // Or we can use the serveUrl passed in the body if we want to be flexible.
        // For now, let's assume a placeholder serveUrl or require it in the request.

        // NOTE: You must run `npx tsx scripts/deploy-lambda.ts` to get a serveUrl first!
        const serveUrl = process.env.REMOTION_LAMBDA_SERVE_URL;

        if (!serveUrl) {
            return NextResponse.json({ error: 'REMOTION_LAMBDA_SERVE_URL environment variable is not set. Please deploy the Remotion site first.' }, { status: 500 });
        }

        const { region } = RemotionLambdaConfig;
        const { bucketName } = await getOrCreateBucket({ region });

        const { renderId, bucketName: renderBucket } = await renderMediaOnLambda({
            region,
            functionName: 'remotion-render', // Default function name
            serveUrl,
            composition: 'MyComposition',
            inputProps: { project },
            codec: 'h264',
            downloadBehavior: {
                type: 'download-on-complete',
                fileName: `project-${project.name || 'video'}.mp4`,
            },
        });

        return NextResponse.json({
            success: true,
            renderId,
            bucketName: renderBucket,
            message: 'Render started on Lambda'
        });

    } catch (error: any) {
        console.error('Lambda render error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
