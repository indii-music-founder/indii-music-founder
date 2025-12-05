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

        // Standardize Error Mapping
        const message = error.message || '';
        if (message.includes('429') || message.includes('quota')) {
            throw new functions.https.HttpsError('resource-exhausted', 'Quota Exceeded', { code: 'QUOTA_EXCEEDED' });
        }
        if (message.includes('safety') || message.includes('blocked')) {
            throw new functions.https.HttpsError('failed-precondition', 'Safety Violation', { code: 'SAFETY_VIOLATION' });
        }
        if (message.includes('400')) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid Request', { code: 'INVALID_ARGUMENT' });
        }

        throw new functions.https.HttpsError('internal', error.message, { code: 'INTERNAL_ERROR' });
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
