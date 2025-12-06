import * as functions from "firebase-functions";
import * as cors from "cors";
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { config } from "../config";
import { GenerateContentRequest, GenerateContentResponse, GenerateVideoRequest } from "../shared/types/ai.dto";

const corsHandler = cors({ origin: true });

// Initialize GenAI with server-side API key
const genAI = new GoogleGenerativeAI(config.apiKey);

export const generateContent = functions.https.onCall(async (data: GenerateContentRequest, context): Promise<GenerateContentResponse> => {
    try {
        const { model: modelName, contents, config: generationConfig } = data;

        if (!modelName || !contents) {
            throw new functions.https.HttpsError('invalid-argument', "Missing model or contents");
        }

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig
        });

        // Ensure contents is an array conforms to Content[]
        const contentArray = (Array.isArray(contents) ? contents : [contents]) as Content[];

        const result = await model.generateContent({ contents: contentArray });
        const response = result.response;

        return response as unknown as GenerateContentResponse;
    } catch (error: any) {
        console.error("Generate Content Error:", error);

        // Extract detailed error message from Gemini SDK error
        const errorMessage = error.message || error.toString() || 'Unknown error';
        const errorDetails = error.errorDetails || error.details || null;

        // Log full error for debugging
        console.error("Full error details:", {
            message: errorMessage,
            details: errorDetails,
            stack: error.stack,
            name: error.name,
            cause: error.cause
        });

        // Standardize Error Mapping
        const messageLower = errorMessage.toLowerCase();
        if (messageLower.includes('429') || messageLower.includes('quota') || messageLower.includes('resource exhausted')) {
            throw new functions.https.HttpsError('resource-exhausted', `Quota Exceeded: ${errorMessage}`, { code: 'QUOTA_EXCEEDED', originalMessage: errorMessage });
        }
        if (messageLower.includes('safety') || messageLower.includes('blocked')) {
            throw new functions.https.HttpsError('failed-precondition', `Safety Violation: ${errorMessage}`, { code: 'SAFETY_VIOLATION', originalMessage: errorMessage });
        }
        if (messageLower.includes('400') || messageLower.includes('invalid')) {
            throw new functions.https.HttpsError('invalid-argument', `Invalid Request: ${errorMessage}`, { code: 'INVALID_ARGUMENT', originalMessage: errorMessage });
        }
        if (messageLower.includes('not found') || messageLower.includes('404') || messageLower.includes('model')) {
            throw new functions.https.HttpsError('not-found', `Model or resource not found: ${errorMessage}`, { code: 'NOT_FOUND', originalMessage: errorMessage });
        }
        if (messageLower.includes('auth') || messageLower.includes('api key') || messageLower.includes('permission') || messageLower.includes('401') || messageLower.includes('403')) {
            throw new functions.https.HttpsError('unauthenticated', `Authentication error: ${errorMessage}`, { code: 'AUTH_ERROR', originalMessage: errorMessage });
        }

        // Default: forward the actual error message
        throw new functions.https.HttpsError('internal', `Internal error: ${errorMessage}`, { code: 'INTERNAL_ERROR', originalMessage: errorMessage });
    }
});

export const generateContentStream = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { model: modelName, contents, config: generationConfig } = req.body;

            if (!modelName || !contents) {
                res.status(400).send({ error: "Missing model or contents" });
                return;
            }

            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig
            });

            // Ensure contents is an array
            const contentArray = (Array.isArray(contents) ? contents : [contents]) as Content[];

            const result = await model.generateContentStream({ contents: contentArray });

            // Set headers for streaming
            res.setHeader('Content-Type', 'application/x-ndjson');
            res.setHeader('Transfer-Encoding', 'chunked');

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                // Send as NDJSON
                res.write(JSON.stringify({ text: chunkText }) + '\n');
            }

            res.end();
        } catch (error: any) {
            console.error("Generate Content Stream Error:", error);
            // If headers haven't been sent, send error json
            if (!res.headersSent) {
                res.status(500).send({ error: error.message });
            } else {
                // Otherwise end the stream
                res.end();
            }
        }
    });
});

export const embedContent = functions.https.onCall(async (data, context) => {
    try {
        const { model: modelName, content } = data;

        if (!modelName || !content) {
            throw new functions.https.HttpsError('invalid-argument', "Missing model or content");
        }

        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.embedContent({ content });

        return result;
    } catch (error: any) {
        console.error("Embed Content Error:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const generateVideo = functions.https.onCall(async (data: GenerateVideoRequest, context) => {
    try {
        // Mock Implementation or placeholder
        return {};
    } catch (e: any) {
        throw new functions.https.HttpsError('internal', e.message);
    }
});
