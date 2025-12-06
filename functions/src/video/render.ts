import * as functions from "firebase-functions";
import { renderMediaOnLambda } from "@remotion/lambda";

// Basic configuration - in a real app these should be environment variables
const REGION = 'us-east-1';
const FUNCTION_NAME = 'remotion-render';
const SERVE_URL = 'remotion-server-url'; // This would need to be dynamically set or passed

interface RenderVideoRequest {
    compositionId: string;
    inputProps: any;
    frameRange?: [number, number];
}

export const renderVideo = functions.https.onCall(async (data: RenderVideoRequest, context) => {
    try {
        const { compositionId, inputProps, frameRange } = data;

        if (!compositionId) {
            throw new functions.https.HttpsError('invalid-argument', 'compositionId is required');
        }

        // NOTE: This assumes the Lambda function is already deployed and configured
        // In a production environment, you would use getSites() or similar to find the serveUrl

        const result = await renderMediaOnLambda({
            region: REGION,
            functionName: FUNCTION_NAME,
            serveUrl: SERVE_URL, // This needs to be the URL where the Remotion bundle is hosted
            composition: compositionId,
            inputProps: inputProps || {},
            codec: 'h264',
            ...(frameRange ? {
                framesPerLambda: 20,
            } : {})
        });

        return result;
    } catch (error: any) {
        console.error("Render Video Error:", error);
        throw new functions.https.HttpsError('internal', error.message || "Failed to render video");
    }
});
