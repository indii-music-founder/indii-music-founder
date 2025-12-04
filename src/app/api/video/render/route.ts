import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project } = body;

        if (!project) {
            return NextResponse.json(
                { success: false, error: 'No project data provided' },
                { status: 400 }
            );
        }

        // 1. Bundle the composition
        // In a real app, you'd cache this bundle or build it at deploy time.
        // We use a simplified webpack config if needed, but defaults usually work.
        const entryPoint = path.join(process.cwd(), 'src/modules/video/remotion/index.ts');
        console.log('Bundling from:', entryPoint);

        const bundleLocation = await bundle({
            entryPoint,
            // In Next.js, we might need to be careful with webpack, but let's try default first.
        });

        // 2. Select the composition
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: 'MyComp',
            inputProps: { project },
        });

        // 3. Render the video
        const outputFilename = `render-${Date.now()}.mp4`;
        const outputLocation = path.join(process.cwd(), 'public', 'renders', outputFilename);

        // Ensure directory exists
        const renderDir = path.dirname(outputLocation);
        if (!fs.existsSync(renderDir)) {
            fs.mkdirSync(renderDir, { recursive: true });
        }

        console.log('Rendering to:', outputLocation);

        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation,
            inputProps: { project },
        });

        // 4. Return the URL
        const publicUrl = `/renders/${outputFilename}`;

        return NextResponse.json({
            success: true,
            url: publicUrl
        });

    } catch (error: any) {
        console.error('Render failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
