import 'dotenv/config';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3001;
const API_KEY = process.env.VITE_API_KEY;
const BASE_URL = 'https://generativelanguage.googleapis.com';

if (!API_KEY) {
    console.error("❌ No VITE_API_KEY found in .env");
    process.exit(1);
}

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        // Construct upstream URL
        // req.url includes /v1beta/...
        const upstreamPath = req.url;
        const upstreamUrl = new URL(upstreamPath || '/', BASE_URL);

        // Append API Key
        upstreamUrl.searchParams.append('key', API_KEY);

        console.log(`[Proxy] ${req.method} ${upstreamUrl.pathname}`);

        const options: https.RequestOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const proxyReq = https.request(upstreamUrl, options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
            proxyRes.pipe(res);
        });

        req.pipe(proxyReq);

        proxyReq.on('error', (e) => {
            console.error(`[Proxy] Request Error: ${e.message}`);
            res.writeHead(500);
            res.end(`Proxy Error: ${e.message}`);
        });

    } catch (e: any) {
        console.error(`[Proxy] Error: ${e.message}`);
        res.writeHead(500);
        res.end(`Internal Error: ${e.message}`);
    }
});

server.listen(PORT, () => {
    console.log(`🚀 RAG Proxy running on http://localhost:${PORT}`);
    console.log(`   Target: ${BASE_URL}`);
});
