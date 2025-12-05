"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragProxy = void 0;
const functions = require("firebase-functions");
const cors = require("cors");
const config_1 = require("../config");
const corsHandler = cors({ origin: true });
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
async function fetchGemini(endpoint, options = {}) {
    const url = `${BASE_URL}/${endpoint}?key=${config_1.config.apiKey}`;
    const response = await fetch(url, Object.assign(Object.assign({}, options), { headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers) }));
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.json();
}
exports.ragProxy = functions.https.onRequest(async (req, res) => {
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
        }
        catch (error) {
            console.error("RAG Proxy Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
});
//# sourceMappingURL=retrieval.js.map