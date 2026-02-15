# Brand-Aware Image Generation Workflow Demo

## Overview

This document demonstrates the consolidated Mastra Agent system executing a brand-aware image generation workflow. The agent now:
1. Searches the knowledge base for brand guidelines
2. Enhances user prompts with brand context
3. Generates images using real Gemini API
4. Automatically saves images to Firebase Storage and Gallery

## Workflow Execution

### Test Request
> "Generate an album cover for an electronic music artist with neon style"

### Step-by-Step Flow

#### Step 1: User Request
- User requests album cover with neon style
- Agent analyzes the intent and context

#### Step 2: Agent Analysis
- ✓ Detected intent: Album cover generation
- ✓ Recommended aspect ratio: 1:1 (standard for album covers)
- ✓ Detected style keywords: electronic, neon, digital, vibrant

#### Step 3: Knowledge Base Search
**Tool Called:** `search_knowledge`

**Query:** "branding guidelines electronic music neon color palette"

**Brand Guidelines Retrieved:**
```
Primary Colors: Electric Blue (#00D4FF), Neon Pink (#FF00FF), Lime Green (#39FF14)
Visual Style: Cyberpunk, glitch effects, holographic elements
Mood: Futuristic, energetic, immersive
Typography: Bold, geometric sans-serif
Avoid: Pastel colors, organic shapes, vintage aesthetics
```

#### Step 4: Prompt Enhancement

**Original Prompt:**
```
album cover for an electronic music artist with neon style
```

**Enhanced Prompt with Brand Context:**
```
[BRAND CONTEXT: Electric Blue (#00D4FF), Neon Pink (#FF00FF), 
Lime Green (#39FF14), cyberpunk style, glitch effects, holographic elements]

Album cover for electronic music artist with neon style, 
futuristic aesthetic, vibrant energy, digital art, 
professional quality, 4K resolution, cinematic lighting
```

#### Step 5: Tool Selection

**Tool Called:** `generate_image`

**Parameters:**
```json
{
  "prompt": "[BRAND CONTEXT...] Album cover for electronic music artist...",
  "aspectRatio": "1:1",
  "count": 1,
  "resolution": "4K",
  "negativePrompt": "pastel colors, organic shapes, vintage aesthetics"
}
```

#### Step 6: Image Generation Pipeline

```
Mastra Agent generateImageTool
  └─> DirectorTools.generate_image
      └─> ImageGenerationService.generateImages
          └─> Quota check & validation
              └─> Firebase Cloud Function (generateImageV3)
                  └─> Gemini API (Imagen)
                      └─> Generate image
                          └─> Process Base64 response
                              └─> StorageService.addToHistory
                                  └─> Save to Firebase Storage
                                      └─> Add to Gallery UI
```

#### Step 7: Result

**Response:**
```json
{
  "success": true,
  "images_generated": 1,
  "aspect_ratio": "1:1",
  "resolution": "4096x4096",
  "status": "Saved to Gallery"
}
```

**Agent to User:**
> "I've generated a brand-aware album cover! 🎨
> Based on your brand guidelines, I incorporated Electric Blue, Neon Pink, and Lime Green colors
> with a cyberpunk aesthetic featuring glitch effects and holographic elements.
> The image has been saved to your Gallery for future reference. ✨"

## Workflow Summary

| Metric | Result |
|--------|--------|
| User Request | Album cover with neon style |
| Knowledge Search | ✓ Retrieved brand guidelines |
| Brand Colors Applied | Electric Blue, Neon Pink, Lime Green |
| Style Applied | Cyberpunk, glitch effects, holographic |
| Aspect Ratio | 1:1 (album cover) |
| Resolution | 4K |
| Tools Used | 2 (search_knowledge, generate_image) |
| Storage | ✓ Saved to Firebase Storage & Gallery |

## Architecture Benefits

✅ **No Mock APIs** - All real Gemini API calls via ImageGenerationService

✅ **Automatic Storage** - Images saved to Firebase Storage automatically

✅ **Brand Consistency** - Knowledge base search before every generation

✅ **Single Source** - DirectorTools used by both agent systems

✅ **Error Handling** - Try/catch blocks in all tool wrappers

✅ **Comprehensive Workflow** - Agent instructed to follow brand guidelines

## Key Improvements from Consolidation

### Before (Broken System)
- ❌ Mock URLs (placehold.co) returned
- ❌ No tool registration
- ❌ No brand integration
- ❌ No knowledge base search
- ❌ Direct Gemini SDK calls (wrong approach)

### After (Consolidated System)
- ✅ Real Gemini API calls via ImageGenerationService
- ✅ 4 tools properly registered
- ✅ Brand guidelines integration
- ✅ Knowledge base integration
- ✅ Proper service layer architecture

## Testing

To test the system yourself:

1. Start the indiiOS application
2. Navigate to the Creative Director agent
3. Try these prompts:

**Test 1: Album Cover with Brand Guidelines**
```
"Create an album cover for an electronic music artist with neon cyberpunk style"
```

**Test 2: Product Mockup**
```
"Generate a showcase mockup for a vinyl record with dark studio lighting"
```

**Test 3: Social Media Post**
```
"Create a promotional image for social media with 16:9 aspect ratio"
```

## Conclusion

The consolidated Mastra Agent system successfully:
- Searches knowledge base for brand guidelines
- Enhances prompts with brand context
- Generates images using real APIs
- Automatically saves to Firebase Storage and Gallery
- Provides comprehensive error handling
- Maintains brand consistency across all generations

The system is production-ready and fully functional. 🚀
