"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVideo = void 0;
const functions = require("firebase-functions");
const lambda_1 = require("@remotion/lambda");
// Basic configuration - in a real app these should be environment variables
const REGION = 'us-east-1';
const FUNCTION_NAME = 'remotion-render';
const SERVE_URL = 'remotion-server-url'; // This would need to be dynamically set or passed
exports.renderVideo = functions.https.onCall(async (data, context) => {
    try {
        const { compositionId, inputProps, frameRange } = data;
        if (!compositionId) {
            throw new functions.https.HttpsError('invalid-argument', 'compositionId is required');
        }
        // NOTE: This assumes the Lambda function is already deployed and configured
        // In a production environment, you would use getSites() or similar to find the serveUrl
        const result = await (0, lambda_1.renderMediaOnLambda)(Object.assign({ region: REGION, functionName: FUNCTION_NAME, serveUrl: SERVE_URL, composition: compositionId, inputProps: inputProps || {}, codec: 'h264' }, (frameRange ? {
            framesPerLambda: 20,
        } : {})));
        return result;
    }
    catch (error) {
        console.error("Render Video Error:", error);
        throw new functions.https.HttpsError('internal', error.message || "Failed to render video");
    }
});
//# sourceMappingURL=render.js.map