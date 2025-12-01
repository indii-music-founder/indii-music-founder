# RAG System & Proxy Setup

The RAG (Retrieval-Augmented Generation) system uses the Gemini Semantic Retriever API.
Due to CORS restrictions on the `generativelanguage.googleapis.com` API when called from a browser, a local proxy server is required for development.

## 1. Start the Proxy Server

Run the following command in a separate terminal:

```bash
npx tsx scripts/start-proxy.ts
```

This starts a proxy on `http://localhost:3001` that forwards requests to the Gemini API.

## 2. Configure the App

Ensure your `.env` file has the following variables:

```env
VITE_API_KEY=your_api_key_here
VITE_RAG_PROXY_URL=http://localhost:3001
```

## 3. Run Stress Test

You can run the stress test script (which now supports the proxy) to verify the system:

```bash
npx tsx scripts/stress-test-rag.ts
```

Or use the "Stress Test" button in the Knowledge Base UI.

## Troubleshooting

* **404 Not Found on `createDocument`**: This is a known issue with the current API configuration/key. `createCorpus` works, but `createDocument` fails. This might be due to API versioning or project restrictions.
* **CORS Errors**: Ensure the proxy is running and `VITE_RAG_PROXY_URL` is set.
