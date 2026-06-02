# Direct Image Generation Vertex AI Architecture

This flowchart maps the direct Creative Hub image-generation path. It documents the thin-client payload boundary that prevents raw Base64 and `null` reference fields from reaching the `generateImageV3` Cloud Function.

```mermaid
graph TD
    User["User enters prompt in DirectGenerationTab"] --> Hook["useDirectGeneration.handleImageGenerate"]
    Hook --> RefGate{"Reference ingredient selected?"}
    RefGate -- "No" --> Compact["compactCallablePayload removes undefined and null keys"]
    RefGate -- "Yes" --> Upload["CreativeStorageService.uploadReferenceMedia"]
    Upload --> ExistingGs{"Input already gs://?"}
    ExistingGs -- "Yes" --> KeepUri["Return existing gs:// URI unchanged"]
    ExistingGs -- "No" --> UploadStorage["Upload data, Blob, File, or fetched HTTP media to Firebase Storage"]
    UploadStorage --> NewUri["Return new gs:// URI"]
    KeepUri --> Compact
    NewUri --> Compact
    Compact --> Callable["httpsCallable functions generateImageV3"]
    Callable --> Zod["GenerateImageSchema validates prompt, aspectRatio, model, imageSize, referenceUri"]
    Zod --> Reject{"Payload contains null, Base64, or non-gs referenceUri?"}
    Reject -- "Yes" --> Invalid["invalid-argument: Payload validation failed"]
    Reject -- "No" --> Gemini["Cloud Function calls Gemini image model through Vertex AI"]
    Gemini --> OutputStorage["Generated image bytes saved to Cloud Storage"]
    OutputStorage --> ResultUri["Return jobId and resultUri"]
    ResultUri --> Listener["DirectGenerationTab Firestore listener resolves resultUri"]
    Listener --> Gallery["Generated image appears in Creative gallery and editor"]

    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#042f2e;
    classDef logic fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#2e1065;
    classDef storage fill:#fff7ed,stroke:#ff8f00,stroke-width:2px,color:#431407;
    classDef cloud fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#052e16;
    classDef error fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#500724;

    class User,Gallery ui;
    class Hook,RefGate,ExistingGs,Compact logic;
    class Upload,UploadStorage,KeepUri,NewUri,OutputStorage storage;
    class Callable,Zod,Gemini,ResultUri,Listener cloud;
    class Reject,Invalid error;
```

## Transition Breakdown

1. The user starts direct image generation from `packages/renderer/src/modules/creative/components/DirectGenerationTab.tsx`. The component delegates execution to `useDirectGeneration.handleImageGenerate` in `packages/renderer/src/modules/creative/hooks/useDirectGeneration.ts`.
2. The hook checks `videoInputs.ingredients[0]`. If no reference ingredient exists, `referenceUri` remains unset and `compactCallablePayload` removes it before the Firebase callable request is made.
3. If a reference ingredient exists, `CreativeStorageService.uploadReferenceMedia` enforces the thin-client media boundary. Existing `gs://` strings pass through unchanged. Data URLs, `Blob`, `File`, and HTTP references are uploaded into Firebase Storage and converted to `gs://` before use.
4. The callable payload sent to `generateImageV3` contains only concrete values. This prevents the strict Zod schema in `packages/firebase/src/functions/creative/gateway.ts` from receiving `referenceUri: null`, raw Base64, or an HTTP URL.
5. The Cloud Function validates the request. Invalid payloads fail at the Zod gate with `invalid-argument`; valid payloads continue to the Gemini image model via the backend Vertex AI client.
6. Generated image bytes are saved to Cloud Storage by the Cloud Function. The client receives lightweight job metadata and resolves the final Storage URL through the Firestore job listener before adding the image to the Creative gallery/editor.
