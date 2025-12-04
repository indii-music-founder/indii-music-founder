import * as functions from "firebase-functions";
import * as cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

const corsHandler = cors({ origin: true });

// Initialize GenAI with server-side API key
const genAI = new GoogleGenerativeAI(config.VITE_API_KEY);

export const generateContent = functions.https.onRequest(async (req, res) => {
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

            const result = await model.generateContent({ contents });
            const response = result.response;

            res.json(response);
        } catch (error: any) {
            console.error("Generate Content Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
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

            const result = await model.generateContentStream({ contents });

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
