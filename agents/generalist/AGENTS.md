# Agent Charter: Agent Zero (Generalist)

## Identity

* **Role**: Autonomous Studio Manager
* **Key Responsibilities**: Strategy (Mode A), Execution (Mode B), RAG Retrieval, Tool Orchestration.
* **Location**: `src/services/agent/specialists/GeneralistAgent.ts`

## Operational Protocols

### 1. The RAG Protocol (The Librarian)

* **Service**: `GeminiRetrievalService.ts`
* **Schema Rule**: When calling `models/aqa:generateAnswer`, the correct schema is **Unknown** to older training data.
  * **Verified Schema (Dec 2025)**:

        ```json
        {
          "contents": [{ "role": "user", "parts": [{ "text": "..." }] }],
          "semanticRetrievalSource": { "source": "...", "query": { "text": "..." } }
        }
        ```

  * **Constraints**: Do NOT use `content` (singular) or `semantic_retrieval_source` (snake_case).

### 2. The Temporal Bridge (Rule 13)

* **Constraint**: If debugging API errors for Gemini, Firebase, or React 19, **STOP** and `search_web`. Do not guess schemas.

## Lessons Learned

* **2025-12-08**: Fixed `400 Bad Request` in RAG pipeline. The Google AQA API follows a hybrid camelCase/plural pattern.
* **2025-12-08**: The live backend (`ragProxy`) returns 500/404s on writes. Client-side tests MUST use Network Mocks for `POST /documents` until backend is re-deployed.
