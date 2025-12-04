"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedContent = exports.generateContentStream = exports.generateContent = void 0;
const functions = require("firebase-functions");
const cors = require("cors");
const generative_ai_1 = require("@google/generative-ai");
const config_1 = require("../config");
const corsHandler = cors({ origin: true });
// Initialize GenAI with server-side API key
const genAI = new generative_ai_1.GoogleGenerativeAI(config_1.config.VITE_API_KEY);
exports.generateContent = functions.https.onRequest(async (req, res) => {
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
        }
        catch (error) {
            console.error("Generate Content Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
});
exports.generateContentStream = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        var _a, e_1, _b, _c;
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
            try {
                for (var _d = true, _e = __asyncValues(result.stream), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    const chunkText = chunk.text();
                    // Send as NDJSON
                    res.write(JSON.stringify({ text: chunkText }) + '\n');
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            res.end();
        }
        catch (error) {
            console.error("Generate Content Stream Error:", error);
            // If headers haven't been sent, send error json
            if (!res.headersSent) {
                res.status(500).send({ error: error.message });
            }
            else {
                // Otherwise end the stream
                res.end();
            }
        }
    });
});
exports.embedContent = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const { model: modelName, content } = req.body;
            if (!modelName || !content) {
                res.status(400).send({ error: "Missing model or content" });
                return;
            }
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.embedContent({ content });
            res.json(result);
        }
        catch (error) {
            console.error("Embed Content Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
});
//# sourceMappingURL=gemini.js.map