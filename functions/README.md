# Firebase Functions API Documentation

This directory contains the server-less backend code for indiiOS, deployed on Firebase Functions.

## Endpoints

### 1. `generateVideo`

**Type:** HTTPS Request
**Description:** Generates a video using Vertex AI (Veo model).

**Request Body:**

```json
{
  "prompt": "string",
  "model": "string (optional, default: veo-3.1-generate-preview)",
  "image": "string (optional, base64)",
  "config": {
    "lastFrame": "boolean (optional)"
  }
}
```

**Response:**
Returns the JSON response from the Vertex AI API.

---

### 2. `creativeDirectorAgent`

**Type:** HTTPS Request
**Description:** Invokes the Creative Director agent to generate a creative brief or direction based on a prompt.

**Request Body:**

```json
{
  "prompt": "string"
}
```

**Response:**

```json
{
  "result": "string (Agent output)"
}
```

---

### 3. `editImage`

**Type:** Callable (Firebase SDK)
**Description:** Edits an image using Gemini 3 Pro Image Preview (Vertex AI). Supports inpainting if a mask is provided.

**Parameters:**

- `image`: string (Base64 encoded image data)
- `mask`: string (Optional, Base64 encoded mask data)
- `prompt`: string (Instruction for the edit)

**Returns:**
JSON object containing the generated image content.

---

### 4. `triggerVideoGeneration`

**Type:** Callable (Firebase SDK)
**Description:** Triggers a background video generation task via Inngest. This is an asynchronous operation.

**Parameters:**

- `prompt`: string
- `image`: string (Optional)
- `model`: string (Optional)

**Returns:**

```json
{
  "success": true,
  "message": "Video generation triggered"
}
```

---

### 5. `inngestFn`

**Type:** HTTPS Request
**Description:** The entry point for Inngest webhooks. It handles background event processing and function execution.

## Environment Variables

The functions rely on the following environment variables (set in Firebase config or `.env`):

- `GCLOUD_PROJECT`: The Google Cloud Project ID.
