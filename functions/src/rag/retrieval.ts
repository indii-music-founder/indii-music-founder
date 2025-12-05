import * as functions from "firebase-functions";
import * as cors from "cors";
import { config } from "../config";

const corsHandler = cors({ origin: true });
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

async function fetchGemini(endpoint: string, options: RequestInit = {}) {
    const url = `${BASE_URL}/${endpoint}?key=${config.apiKey}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
}

export const ragProxy = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            // Expect path like /v1beta/corpora/...
            // We strip /v1beta/ to get the endpoint
            const path = req.path;
            const endpoint = path.replace(/^\/v1beta\//, '').replace(/^\//, ''); // Remove leading /v1beta/ or /

            if (!endpoint) {
                res.status(400).send({ error: "Invalid endpoint" });
                return;
            }

            const method = req.method;
            const body = method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined;

            const result = await fetchGemini(endpoint, {
                method,
                body
            });

            res.json(result);
        } catch (error: any) {
            console.error("RAG Proxy Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
});
