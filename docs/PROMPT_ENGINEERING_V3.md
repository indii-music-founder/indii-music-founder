# Gemini 3 ("Nano Banana") Prompt Engineering Standards (V3.0)

This document outlines the mandatory structures for multimodal image editing prompts within indiiOS, optimized for **Gemini 3 Pro** and **2.5 Flash**.

## 1. The "Task-Inputs-Instruction" (TII) Structure

Every automated prompt should follow this hierarchical structure to maximize grounding and spatial reasoning.

### Structure

- **TASK:** High-level operation ID (e.g., `Targeted Inpainting`).
- **INPUTS:** Explicit mapping of provided media to their semantic roles.
- **INSTRUCTION:** Sequential execution steps.
- **CONSTRAINTS:** Environmental and technical requirements.

---

## 2. Standard Templates

### A. Dual-View (Source + Binary Mask)

Use this for Workflow B where a high-fidelity B&W mask is provided.

**Template:**

```text
TASK: Semantic Image Inpainting.
INPUTS:
1. IMAGE_SOURCE: The original high-resolution photo.
2. IMAGE_MASK: A binary mask where WHITE pixels mark the target area.
INSTRUCTION: 
- Analyze IMAGE_SOURCE to understand the lighting, depth, and texture.
- Identify the object or background area under the WHITE pixels in IMAGE_MASK.
- Refine the mask edges to include natural object boundaries based on your spatial reasoning.
- Replace/Modify the content in the target area with: [USER_PROMPT].
CONSTRAINTS:
- Maintain consistent lighting, shadows, and resolution.
- Ensure seamless blending at the edges.
```

### B. Visual Prompting (Flattened Overlay)

Use this for Workflow A/Legacy where the user highlights a red area.

**Template:**

```text
TASK: Object Modification via Visual Prompt.
INPUTS:
1. IMAGE_CANVAS: A photo with a translucent RED overlay highlight.
INSTRUCTION:
- Locate the RED highlighted regions in IMAGE_CANVAS.
- Identify the underlying object or scene element covered by the red highlight.
- Modify the content inside the highlight to: [USER_PROMPT].
CONSTRAINTS:
- Use World Knowledge to infer object boundaries.
- Seamlessly blend the new pixels with the surrounding un-highlighted area.
```

---

## 3. Advanced Reasoning Strategies

### Spatial Inference

If a mask is "loose" (low fidelity), always instruct the model to:
> "Identify the primary object inside the highlight and refine the selection to include the whole object before applying changes."

### Lighting Consistency

Always append:
> "Analyze the light source direction in the source image and apply identical shadows and highlights to the modified content."

---

## 4. Implementation Reference

Update `src/services/image/PromptBuilderService.ts` to implement these standards.
