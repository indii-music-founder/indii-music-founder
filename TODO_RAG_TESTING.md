# 🚨 RAG System Testing To-Do

**Date:** December 1, 2025
**Status:** ⚠️ Pending Verification (API Issues)

## Context

We have implemented **Smart Text Chunking** to improve the RAG system's accuracy. The code is verified and unit tests pass. However, we encountered persistent `404 Not Found` and `429 Too Many Requests` errors from the Google Gemini API when trying to ingest documents into newly created corpora.

## The Issue

- **Corpus Creation:** Success (200 OK).
- **Document Ingestion:** Fails with `404 Not Found` (Corpus not found), even after waiting 10+ seconds.
- **Cause:** Likely Google API propagation delays or temporary service instability.

## Action Items for Next Session

1. **Run the Music Business Test Script**
    This script simulates a real-world scenario with 3 documents (Contract, Marketing Plan, Royalty Guide).

    ```bash
    npx tsx scripts/test-music-biz-rag.ts
    ```

2. **Verify Results**
    - **Success:** The script prints "💡 A: [Answer]" for all 3 questions.
    - **Failure:** You see `404 Not Found` errors again.

3. **If Errors Persist**
    - Check the [Google AI Studio Console](https://aistudio.google.com/) to see if you have hit the limit of 10 corpora.
    - Manually delete old corpora if necessary.
    - Try increasing the delay in `scripts/test-music-biz-rag.ts` (currently 10s).

## Verified Components

- ✅ **Smart Chunking Logic:** Verified via `npx tsx scripts/test-chunker.ts`.
- ✅ **Service Implementation:** `GeminiRetrievalService.ts` is correctly implemented.
