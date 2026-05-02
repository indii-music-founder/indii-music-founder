# The Definitive Guide to the Nano Banana Ecosystem

> **True North Document** — This is the canonical reference for all image generation
> capabilities in indiiOS. All UI controls, backend parameters, and creative workflows
> MUST align with the specifications documented here.
>
> Last Updated: 2026-05-02

---

## Table of Contents

1. [Model Family Overview](#1-model-family-overview)
2. [Capability Matrix](#2-capability-matrix)
3. [Thinking Mode (Reasoning)](#3-thinking-mode-reasoning)
4. [Reference Images & Character Consistency](#4-reference-images--character-consistency)
5. [Search Grounding](#5-search-grounding)
6. [Text Rendering & Localization](#6-text-rendering--localization)
7. [Editing Capabilities](#7-editing-capabilities)
8. [Output Specifications](#8-output-specifications)
9. [Prompt Engineering](#9-prompt-engineering)
10. [API Configuration Reference](#10-api-configuration-reference)
11. [Pricing & Performance](#11-pricing--performance)
12. [Content Provenance & Safety](#12-content-provenance--safety)
13. [indiiOS Implementation Mapping](#13-indiios-implementation-mapping)

---

## 1. Model Family Overview

The "Nano Banana" nomenclature originated as a community-driven codename during
competitive leaderboard testing at LMArena in August 2025. Google subsequently
adopted it as a formal brand pillar for their generative vision strategy.

| Model | Internal Designation | Architecture | Released | Primary Optimization |
|:---|:---|:---|:---|:---|
| **Nano Banana** (v1) | `gemini-2.5-flash-preview-image` | Gemini 2.5 Flash | Aug 2025 | Speed, low-latency, rapid prototyping |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Gemini 3 Pro | Nov 2025 | Maximum quality, advanced reasoning, studio-grade control |
| **Nano Banana 2** | `gemini-3.1-flash-image-preview` | Gemini 3.1 Flash | Feb 2026 | Speed + quality, high-volume production, precise instruction following |

### indiiOS Model Constants

```typescript
// packages/renderer/src/core/config/ai-models.ts
export const AI_MODELS = {
  IMAGE: {
    FAST: 'gemini-3.1-flash-image-preview',   // Nano Banana 2
    PRO: 'gemini-3-pro-image-preview',         // Nano Banana Pro
  }
};
```

### Key Architectural Difference

Unlike conventional CLIP-based models, all Nano Banana models use a **Diffusion
Transformer (DiT)** architecture built on the Gemini reasoning backbone. They
function as digital art directors — understanding semantic logic, physical
causality, and spatial relationships — rather than simple pattern matchers.

---

## 2. Capability Matrix

| Feature / Ability | Nano Banana 2 (Flash) | Nano Banana Pro | Nano Banana v1 |
|:---|:---|:---|:---|
| **Output Resolution** | 512px (0.5K) → 4K | 1K → 4K | up to 2K |
| **Supported Aspect Ratios** | Standard + Extended (14 total, incl. 1:4, 4:1, 1:8, 8:1, 21:9, 2:1) | Standard + 21:9 only | Standard only (1:1, 16:9, 4:3, etc.) |
| **Input Context Window** | 1M tokens (text, code, audio, images) | 1M tokens (text, code, audio, images) | Large multi-image |
| **Max Reference Images** | Up to 14 total | Up to 14 total | Up to 3-4 |
| **Subject Consistency** | 4 characters + 10 objects | 5 characters + 6 objects | Up to 3 characters |
| **Text Rendering** | High (production-grade), supports in-image translation | Highest (studio-grade), highly accurate typography | Basic |
| **Search Grounding** | Web Search **AND** exclusive Google Image Search | Web Search only | Limited |
| **Thinking Mode** | 2 controllable levels (minimal, high) | Always enabled, generates interim "thought images" | None |
| **Content Provenance** | SynthID + C2PA Content Credentials | SynthID only | SynthID only |
| **Editing** | Conversational multi-turn, semantic masking, background variation | Conversational multi-turn, regional editing, style transfer, 360° character views | Basic editing |
| **Speed** | ~3-5s per image, 363 tokens/sec | ~10-25s per image | ~2-3s |
| **API Price** | ~$0.067 (1K/2K), ~$0.134 (4K); $60/M output tokens | ~$0.134 (1K/2K), ~$0.24 (4K); $120/M output tokens | ~$0.038/image |

---

## 3. Thinking Mode (Reasoning)

### Nano Banana Pro — Always On

- Thinking is **enabled by default and cannot be disabled** via the API
- The model generates up to **2 intermediate "thought images"** internally
- These interim images test logic, composition, lighting, and spatial relationships
- The final output is the **last image** in the thinking sequence
- **Thought Signatures:** The model produces encrypted signatures representing its
  internal reasoning. These MUST be captured and passed back in subsequent requests
  for multi-turn editing continuity
- Adds 5-15 seconds latency (total: 10-25 seconds)
- Incurs additional cost for "thinking tokens"

### Nano Banana 2 (Flash) — 2 Controllable Levels

| Level | API Value | Behavior |
|:---|:---|:---|
| **Off** | `none` | No reasoning, fastest output |
| **Minimal** | `minimal` | Default. Optimized for high-throughput tasks |
| **High** | `high` | Full chain-of-thought loop. Verifies logic, plans composition, ensures strict instruction following |

> **CRITICAL:** Flash does NOT support `low` or `medium` thinking levels.
> The UI must only offer: Off / Minimal / High.

### API Parameters

```typescript
// thinkingConfig for Flash
config: {
  thinkingConfig: {
    thinkingBudget: 0 | 1024 | 8192, // none | minimal | high
  },
  includeThoughts: true, // Show reasoning in response
}

// Pro: No thinkingConfig needed (always on)
// Just capture thoughtSignature from response
```

---

## 4. Reference Images & Character Consistency

### Capacity

| Model | Max Reference Images | Max Characters | Max Objects |
|:---|:---|:---|:---|
| **Nano Banana 2** | 14 | 4 characters | 10 distinct objects |
| **Nano Banana Pro** | 14 | 5 characters | 6 distinct objects |

### How Reference Images Work

Think of this as **"few-shot prompting for designers."** Upload an entire visual
style guide — logos, color palettes, character turnarounds, product shots — and the
AI blends scenes, transfers designs, and ensures brand fidelity.

### Best Practices

1. **Reuse exact reference images** across all generation requests for consistency
2. **Feed generated images back** as references for iterative refinement (e.g., 360° views)
3. **Always include descriptive text** even when using reference images
4. **Guide pose and environment** with consistent lighting/compositional directions
5. **Prioritize upload order:** First 2-3 images = main aesthetic; remaining = refinements

### Use Cases

- **Group Compositions:** Multiple portraits → single coherent group photo
- **E-Commerce Catalogs:** Product references → lifestyle mockups at scale
- **Brand Consistency:** Logo + colors + aesthetic → guaranteed corporate identity
- **360° Character Views:** Iteratively prompt different angles, feed back as references
- **Storyboarding:** Same cast maintained across multiple narrative scenes

### 360-Degree Character Views (Pro)

Pro preserves **photorealistic character appearances and facial features** across images.
Process:
1. Start with a base reference image
2. Prompt: "A studio portrait of this person against white, in profile looking right"
3. Feed generated profile views back as references for remaining angles
4. Include a separate pose reference if complex body positioning is needed

---

## 5. Search Grounding

### Web Search Grounding (Both Models)

Integrates real-time Google Search data into generation for factual accuracy:
- Specific landmarks with accurate architectural details
- Biological/technical subjects with real visual references
- Live data visualization (weather, financial reports)
- Historical/cultural era-specific aesthetics

### Google Image Search Grounding (Flash ONLY)

**Exclusive to Nano Banana 2.** Not available on Pro.

The model searches for web images via Google Search and uses them as direct visual
context during generation.

#### API Configuration

```typescript
tools: [{
  googleSearch: {
    searchTypes: ['imageSearch'], // Can combine with standard search
  }
}]
```

#### Response Metadata

```typescript
// groundingMetadata in response
{
  imageSearchQueries: string[],     // Queries the model used
  groundingChunks: [{
    uri: string,        // Landing page for attribution
    image_uri: string,  // Direct image URL
  }]
}
```

#### Strict Rules

- **No People:** Cannot search for real-world images of people
- **Source Attribution:** Must provide recognizable link to containing webpage
- **Direct Navigation:** Single-click path from source image to source page (no intermediate viewers)

---

## 6. Text Rendering & Localization

### Text Rendering Accuracy

- **Pro:** 94% accuracy — studio-grade, highly accurate typography and layout
- **Flash (NB2):** Production-grade, supports in-image text translation and multi-language localization
- Supports 100+ languages including Spanish, Hindi, Arabic, Korean, Mandarin Chinese

### In-Image Text Translation

A standout feature: translate embedded text within an image into another language
while preserving the surrounding visual composition.

**Process:**
1. Generate (or upload) an image with text
2. Follow up: "Update this infographic to be in Spanish. Do not change any other elements"
3. Model replaces text while preserving layout, icons, background, perspective

### Typography Control

The model responds to specific typographic instructions:
- Font styles: "bold sans-serif," "Century Gothic 12px"
- Texture: calligraphy, retro, blocky
- Placement: exact positioning directives

---

## 7. Editing Capabilities

### Conversational Multi-Turn Editing (Both Models)

Natural language commands replace traditional mask-based editing:

- **No-Mask Inpainting (Semantic Masking):** "Change only the blue sofa to vintage brown leather"
- **Vibe/Lighting Shifts:** "Change from sunny day to moody night"
- **Multi-Image Fusion:** Combine texture from fabric sample onto 3D armchair render
- **Style Transfer:** "Transform this photograph into Van Gogh's Starry Night style"
- **Restoration:** Restore and enhance old/damaged photos conversationally

### Pro-Exclusive Editing

- **Regional Editing:** Precise area-specific modifications
- **360° Character Views:** Generate different angles maintaining exact likeness
- **Advanced Style Transfer:** Complex artistic treatments with reasoning

### Thought Signatures for Edit Continuity

```typescript
// Capture from initial generation
const thoughtSignature = response.candidates[0].thoughtSignature;

// Pass back in follow-up edit request
const editRequest = {
  contents: [
    { role: 'user', parts: [{ text: 'Change the background to sunset' }] },
  ],
  thoughtSignature: thoughtSignature, // Preserves reasoning context
};
```

---

## 8. Output Specifications

### Resolution Tiers

| Tier | Pixel Range | Flash Support | Pro Support | Use Case |
|:---|:---|:---|:---|:---|
| **0.5K** | 512px | ✅ | ❌ | Mobile previews, batch prototyping |
| **1K** | ~1024px | ✅ | ✅ (minimum) | Standard web use |
| **2K** | ~2048px | ✅ | ✅ | Production assets |
| **4K** | ~4096px | ✅ | ✅ | Large-format print, max quality |

> **Batch-to-Upscale Workflow:** Generate dozens of 0.5K variations via Batch API
> at 50% discount, select the best composition, upscale only that to 4K.

### Aspect Ratios

#### Standard (Both Models)

| Ratio | Label | Use Case |
|:---|:---|:---|
| 1:1 | Square | Social posts, profile images |
| 4:3 | Classic | Traditional display |
| 3:4 | Classic Portrait | Portrait orientation |
| 3:2 | Photo | Photography standard |
| 2:3 | Photo Portrait | Portrait photography |
| 16:9 | Landscape | Video thumbnails, widescreen |
| 9:16 | Portrait | Stories, reels, TikTok |
| 4:5 | Social Portrait | Instagram portrait |
| 5:4 | Balanced | Balanced landscape |
| 21:9 | Cinematic | Ultra-wide, cinematic |

#### Extended (Flash ONLY)

| Ratio | Label | Use Case |
|:---|:---|:---|
| 4:1 | Panoramic | Web banners |
| 1:4 | Tall Banner | Vertical banners |
| 8:1 | Ultra Wide | Panoramas |
| 1:8 | Story Strip | Long infographics |
| 2:1 | Wide | Wide compositions |

---

## 9. Prompt Engineering

### The Prompt Formula

Professional prompting for Nano Banana has shifted from keyword-stuffing to
**structured natural language narratives**:

```
[Subject] + [Composition/Framing/Angle] + [Action] + [Location] + [Artistic Style]
```

### Camera & Lens Control

Specify exact hardware for visual DNA control:
- Camera: "GoPro" (distortion), "Phase One" (luxury jewelry), "Hasselblad"
- Lens: "macro lens," "f/1.8 aperture," "35mm wide angle"
- Angle: "bird's eye view," "low angle," "Dutch tilt"

### Lighting Design

Studio-specific lighting yields best results:
- "Three-point softbox setup"
- "Chiaroscuro lighting"
- "Golden hour backlighting"
- "Rembrandt lighting with butterfly fill"

### Prompt Weighting

Nano Banana 2 supports weight syntax:
```
(word:1.4)  — Emphasize element
(word:0.6)  — De-emphasize element
```

### Negative Prompting

Both Flash and Pro support negative prompts:
```
Negative: "no blurry parts, no extra limbs, no watermarks, no independent-photo framing"
```

### Pro Tips

1. **Be explicit about style:** "digital illustration, vector art, flat colors" > "illustration"
2. **Include medium:** "oil painting on canvas" > "painting style"
3. **Describe relationships:** "A cat sitting ON TOP OF a bookshelf" > "cat bookshelf"
4. **Use cultural references:** "1970s analog film grain," "90s disposable camera aesthetic"

---

## 10. API Configuration Reference

### Request Parameters

```typescript
interface NanoBananaGenerationConfig {
  // Model selection
  model: 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image-preview';

  // Generation config
  generationConfig: {
    responseModalities: ['IMAGE'] | ['TEXT', 'IMAGE']; // Image-only or interleaved
    temperature: 1.0;           // MUST remain at 1.0
    maxOutputTokens: number;    // Varies by resolution
  };

  // Thinking (Flash only — Pro is always on)
  thinkingConfig?: {
    thinkingBudget: 0 | 1024 | 8192; // none | minimal | high
    includeThoughts?: boolean;
  };

  // Safety
  safetySettings: SafetySetting[];
  personGeneration: 'dont_allow' | 'allow_adult' | 'allow_all';

  // Grounding
  tools?: [{
    googleSearch?: {
      searchTypes?: ['imageSearch']; // Flash only
    };
  }];

  // Image-specific
  aspectRatio?: string;           // e.g. "16:9"
  imageSize?: '0.5K' | '1K' | '2K' | '4K';  // Resolution tier
  numberOfImages?: 1 | 2 | 3 | 4; // Batch count

  // Editing continuity
  conversationHistory?: Content[]; // Previous turns
  thoughtSignature?: string;       // From previous Pro generation
}
```

### Response Structure

```typescript
interface NanoBananaResponse {
  candidates: [{
    content: {
      parts: [
        { text?: string },
        { inlineData?: { mimeType: string; data: string } }
      ];
    };
    // Pro only
    thoughtSignature?: string;
    // Grounding metadata
    groundingMetadata?: {
      imageSearchQueries?: string[];
      groundingChunks?: Array<{
        uri: string;
        image_uri: string;
      }>;
    };
  }];
}
```

---

## 11. Pricing & Performance

### Generation Speed

| Model | Latency | Tokens/sec | 1000 Images Time |
|:---|:---|:---|:---|
| **Nano Banana 2** | 3-5s | 363 | ~80 minutes |
| **Nano Banana Pro** | 10-25s | — | ~5+ hours |
| Midjourney v7 | 10-30s | — | 12+ hours |

### Cost Per Image

| Model | 1K/2K Image | 4K Image | Per Million Output Tokens |
|:---|:---|:---|:---|
| **Nano Banana 2** | ~$0.067 | ~$0.134 | $60 |
| **Nano Banana Pro** | ~$0.134 | ~$0.24 | $120 |
| Nano Banana v1 | ~$0.038 | — | — |

### Competitive Benchmarks (LM Arena, Early 2026)

| Category | NB2 | GPT Image 1.5 | Midjourney v7 | FLUX.2 Pro |
|:---|:---|:---|:---|:---|
| **Elo Rank** | **1360** | 1264 | ~1200 | 1265 |
| **Realism** | **9.2/10** | 8.8 | 9.0 | 8.5 |
| **Text Accuracy** | 87-96% | **95%** | 70% | 75% |
| **Max Resolution** | **4K** | 1.5K | High | 4 MP |

---

## 12. Content Provenance & Safety

### Watermarking

| Feature | NB2 | Pro | v1 |
|:---|:---|:---|:---|
| **SynthID** | ✅ Invisible digital watermark, persists through crop/edit | ✅ | ✅ |
| **C2PA Content Credentials** | ✅ Industry-standard creation history metadata | ❌ | ❌ |

### Safety Configuration

```typescript
personGeneration: 'dont_allow' | 'allow_adult' | 'allow_all';

safetySettings: [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];
```

---

## 13. indiiOS Implementation Mapping

### UI Controls → API Parameters

| UI Control (CreativePanel.tsx) | State Key | API Parameter | Model Awareness |
|:---|:---|:---|:---|
| Flash / Pro toggle | `model` | Model endpoint selection | Both |
| Thinking (Off/Min/High) | `thinkingLevel` | `thinkingConfig.thinkingBudget` | Flash only (Pro = always on) |
| Show thoughts toggle | `includeThoughts` | `thinkingConfig.includeThoughts` | Both |
| Person Generation | `personGeneration` | `personGeneration` | Both |
| Google Search toggle | `useGrounding` | `tools[].googleSearch` | Both |
| Image Search toggle | `useImageSearch` | `tools[].googleSearch.searchTypes` | Flash only |
| Batch (1×-4×) | `batchCount` | `numberOfImages` | Both |
| Output (Image / +Text) | `responseFormat` | `responseModalities` | Both |
| Negative Prompt | `negativePrompt` | Appended to prompt or `negativePrompt` field | Both |
| Aspect Ratio | `aspectRatio` | `aspectRatio` | Extreme ratios = Flash only |
| Image Size (0.5K-4K) | `imageSize` | `imageSize` | 0.5K = Flash only; Pro min = 1K |
| Input Resolution | `mediaResolution` | `media_resolution` | Both |

### File Map

| File | Purpose |
|:---|:---|
| `src/core/components/right-panel/CreativePanel.tsx` | Primary Studio Controls UI (single source of truth) |
| `src/core/store/slices/creative/creativeControlsSlice.ts` | Zustand state for all generation parameters |
| `src/services/ai/generators/ImageGenerator.ts` | Low-level `rawGenerateContent` calls |
| `src/services/ai/generators/HighLevelAPI.ts` | Convenience methods with parameter support |
| `src/services/ai/ImageGenerationService.ts` | Service layer orchestrating generation flow |
| `src/core/config/ai-models.ts` | Model constants (FAST / PRO) |

### Key Architecture Decisions

1. **Single Source of Truth:** All generation parameters live in `CreativePanel.tsx`
   right-side panel. The legacy `StudioSettingsPanel.tsx` has been deprecated.
2. **Model-Aware UI:** Controls dynamically adapt based on Flash vs Pro selection
   (thinking levels, aspect ratios, resolution tiers, grounding options).
3. **Backend Ready:** Services (`ImageGenerationService`, `DirectImageGenerator`,
   `HighLevelAPI`) are fully equipped to receive these configuration objects.
   No backend changes needed for UI expansions.
4. **Thought Signature Continuity:** Multi-turn editing requires capturing
   `thoughtSignature` from Pro responses and passing it back in subsequent requests.

---

## Sources

- [Google Blog: Nano Banana 2](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/)
- [Google Blog: Introducing Nano Banana Pro](https://blog.google/innovation-and-ai/products/nano-banana-pro/)
- [Google Cloud: Ultimate Prompting Guide](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)
- [Google Cloud: Bringing NB2 to Enterprise](https://cloud.google.com/blog/products/ai-machine-learning/bringing-nano-banana-2-to-enterprise)
- [Gemini API Docs: Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini API Docs: Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini 3.1 Flash Image Preview](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview)
- [Google AI Studio: Gemini 3.1 Flash Image](https://aistudio.google.com/models/gemini-3-1-flash-image)
- [Dev.to: Getting the Most Out of NB2](https://dev.to/googleai/getting-the-most-out-of-nano-banana-2-502k)
- [Apiyi: NB2 Developer Docs](https://help.apiyi.com/en/nano-banana-2-developer-docs-api-guide-en.html)
- [Skywork: NB2 Benchmark](https://skywork.ai/blog/ai-image/nano-banana-2-benchmark/)
- [LaoZhang: NB2 Hands-On](https://blog.laozhang.ai/en/posts/nano-banana-2-hands-on-speed-test-2k-4k-guide)
- [ALM Corp: Complete Guide](https://almcorp.com/blog/google-nano-banana-2-gemini-31-flash-image-complete-guide/)
- [Together AI: NB Pro API](https://www.together.ai/models/nano-banana-pro)
- [Morphic: NB Pro Guide](https://morphic.com/resources/how-to/nano-banana-pro-guide)
- [Atlas Cloud: NB API Collection](https://www.atlascloud.ai/collections/nanobanana)
- [Freepik: NB2 Guide](https://www.freepik.com/blog/nano-banana-2/)
- [Higgsfield: NB Pro Expert Use Cases](https://higgsfield.ai/blog/Nano-Banana-Pro-Expert-Use-Cases)
- [MasterConcept: 4 Game-Changing Features](https://masterconcept.ai/blog/nano-banana-pro-4-game-changing-features-that-turn-creativity-into-business-value/)
- [Fal.ai: How to Use NB2](https://fal.ai/learn/tools/how-to-use-nano-banana-2)
- [Reddit: LM Arena Results](https://www.reddit.com/r/singularity/comments/1rfes3u/googles_nano_banana_2_gemini_31_flash_image/)
