# Nano Banana 2: Mastering the Thought Signature
**A Developer's Guide to Avoiding 400 Errors & Enabling Multi-Turn Image Editing.**

## 1. Understanding the Thought Signature
*   **NOT an Image:** Although it is base64-encoded, the thought signature is encrypted reasoning data. It cannot be decoded or rendered as a graphic.
*   **The Model's "Memory Snapshot":** It represents the internal state of the model's reasoning process for a specific turn.
*   **Mandatory for Tool Use:** Omitting the signature in multi-turn editing or tool scenarios triggers a `400 INVALID_ARGUMENT` error.

## 2. Distinguishing Response Parts in Nano Banana 2
When parsing the API response, you will encounter distinct payload parts:
*   **Thought Summary (`thought: true`):** A readable text overview of the model's reasoning.
*   **Thought Signature (`thoughtSignature`):** Encrypted, unreadable ciphertext.
*   **Image Data (`inlineData`):** The actual base64 data of the generated image.

## 3. The Multi-Turn Developer Workflow
To successfully implement conversational/multi-turn image editing, follow this sequence:
1.  **Step 1: Capture and Store the Signature.** Extract the `thoughtSignature` parameter from the model's first response and save it in your database alongside the generated image.
2.  **Step 2: Pass Back Exactly As-Is.** When the user provides a follow-up prompt (e.g., "make it darker"), include the previously stored signature in the `parts` array of your next request.
3.  **Emergency Dummy String:** If you lose a signature or need to bypass 400 errors in legacy logs, you can use the fallback placeholder: `"context_engineering_is_the_way_to_go"`.

## 4. Nano Banana Model Comparison
| Model | Standard Use Case | Max Reference Images |
| :--- | :--- | :--- |
| **Nano Banana 2** | High-volume, high-efficiency editing. | Up to 14 |
| **Nano Banana Pro** | Professional, high-fidelity 4K assets. | Up to 14 |
| **Nano Banana (2.5)** | Fast, low-latency basic generation. | Up to 3 |
