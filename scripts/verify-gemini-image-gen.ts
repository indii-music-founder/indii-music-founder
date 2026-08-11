
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getVertexAIClient } from '../packages/firebase/src/lib/vertexClient';

// Load environment variables
dotenv.config();

/**
 * Verification Script for Gemini 3 Pro Image Generation
 *
 * Tests:
 * 1. Model accessibility (gemini-3-pro-image)
 * 2. Response format handling (image bytes extraction)
 * 3. End-to-end output saving
 */
async function verifyGeminiImageGen() {
    console.log('🎨 Initializing Gemini 3 Pro Image Verification...');

    // Match production: Vertex AI with Application Default Credentials on the
    // image-specific global endpoint. Never use a browser or Developer API key.
    const genAI = getVertexAIClient(
        process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
        process.env.VERTEX_IMAGE_LOCATION || 'global',
    );

    const prompt = "A futuristic city floating in the clouds, detailed, 4k, golden hour";

    console.log(`\n🚀 Sending request...`);
    console.log(`   Prompt: "${prompt}"`);
    console.log(`   Config: 4K, 16:9, Google Search Enabled`);

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-3-pro-image',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseModalities: ["IMAGE"],
                imageConfig: {
                    aspectRatio: '16:9',
                    imageSize: '4K',
                },
                tools: [{ googleSearch: {} }],
                safetySettings: [
                    {
                        category: 'HARM_CATEGORY_HARASSMENT',
                        threshold: 'BLOCK_ONLY_HIGH'
                    }
                ],
            } as any
        });

        console.log(`\n✅ Response Received!`);

        // Log candidates stats
        console.log(`   Candidates: ${result.candidates?.length || 0}`);

        if (!result.candidates || result.candidates.length === 0) {
            console.error('❌ No candidates returned.');
            return;
        }

        const firstCandidate = result.candidates[0] as any;

        // Check for image
        const imagePart = firstCandidate.content?.parts?.find((p: any) => p.inlineData && p.inlineData.mimeType?.startsWith('image/'));

        if (imagePart && imagePart.inlineData) {
            console.log(`   🖼️  Image Found!`);
            console.log(`       MimeType: ${imagePart.inlineData.mimeType}`);
            console.log(`       Data Length: ${imagePart.inlineData.data.length} chars`);

            // Save it
            const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
            const filename = `gemini-3-test-${Date.now()}.jpeg`;
            const filepath = path.join(process.cwd(), filename);
            fs.writeFileSync(filepath, buffer);
            console.log(`   💾 Saved to: ${filepath}`);

            // Check for grounding metadata (if any - though usually separate)
            if (firstCandidate.groundingMetadata) {
                console.log(`   🌍 Grounding Metadata Present:`, firstCandidate.groundingMetadata);
            }

        } else {
            console.error('❌ No image data found in response.');
            console.log('   Full Part Types:', firstCandidate.content?.parts?.map((p: any) => Object.keys(p).join(',')));

            // Log text if present (refusal?)
            const textPart = firstCandidate.content?.parts?.find((p: any) => p.text);
            if (textPart) {
                console.log(`   ℹ️  Text Content: ${textPart.text}`);
            }
        }

    } catch (error: any) {
        console.error('\n❌ Generation Failed:', error.message);
        if (error.response) {
            console.error('   API Response:', JSON.stringify(error.response, null, 2));
        }
    }
}

verifyGeminiImageGen();
