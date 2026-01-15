import { BaseAgent } from './BaseAgent';
import { z } from 'zod';
import { FunctionDeclaration } from './types';

/**
 * MerchandiseAgent - AI-First Merchandise Creation
 *
 * Enables conversational merchandise workflows:
 * - "I want to build new T-shirts with my logo"
 * - AI finds assets automatically from Creative Studio
 * - AI lays out products with specified placements
 * - AI asks clarifying questions about purpose
 * - AI executes full workflow autonomously
 *
 * Example Usage:
 * User: "Create T-shirts with my new logo in center chest and left chest positions"
 * Agent: "I found your recent logo. Should I create 3D mockups for your store, or marketing imagery?"
 * User: "Marketing imagery with models"
 * Agent: [Generates mockups with models, creates videos, saves to project]
 */

const MERCHANDISE_TOOLS: FunctionDeclaration[] = [
    {
        name: 'search_assets',
        description: 'Search for logos, designs, and images across all user projects in Creative Studio. Returns matching assets with URLs and metadata.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: {
                    type: 'STRING',
                    description: 'Search query (e.g., "logo", "new design", "brand mark")'
                },
                projectId: {
                    type: 'STRING',
                    description: 'Optional: Limit search to specific project'
                },
                limit: {
                    type: 'NUMBER',
                    description: 'Maximum number of results (default: 10)'
                }
            },
            required: ['query']
        },
        schema: z.object({
            query: z.string().min(1, 'Query cannot be empty'),
            projectId: z.string().optional(),
            limit: z.number().int().positive().max(50).default(10).optional()
        })
    },
    {
        name: 'create_product_mockup',
        description: 'Generate photorealistic product mockup with design applied. Supports multiple product types and placements.',
        parameters: {
            type: 'OBJECT',
            properties: {
                assetUrl: {
                    type: 'STRING',
                    description: 'URL or base64 data of the design/logo to apply'
                },
                productType: {
                    type: 'STRING',
                    enum: ['t-shirt', 'hoodie', 'mug', 'bottle', 'phone', 'poster'],
                    description: 'Type of product'
                },
                placement: {
                    type: 'STRING',
                    description: 'Where to place the design (e.g., "center-chest", "left-chest", "full-front")'
                },
                sceneDescription: {
                    type: 'STRING',
                    description: 'Scene context (e.g., "studio minimal", "urban street", "worn by model")'
                },
                purpose: {
                    type: 'STRING',
                    enum: ['store-listing', 'marketing', '3d-visualization', 'product-catalog'],
                    description: 'Purpose of the mockup to optimize generation'
                }
            },
            required: ['assetUrl', 'productType', 'placement', 'sceneDescription']
        },
        schema: z.object({
            assetUrl: z.string().url('Must be a valid URL or data URL').or(z.string().startsWith('data:', 'Must be URL or base64 data URL')),
            productType: z.enum(['t-shirt', 'hoodie', 'mug', 'bottle', 'phone', 'poster']),
            placement: z.string().min(1, 'Placement required'),
            sceneDescription: z.string().min(10, 'Scene description should be descriptive'),
            purpose: z.enum(['store-listing', 'marketing', '3d-visualization', 'product-catalog']).optional()
        })
    },
    {
        name: 'generate_product_video',
        description: 'Create cinematic product video from mockup. Generates promotional video with camera movements.',
        parameters: {
            type: 'OBJECT',
            properties: {
                mockupUrl: {
                    type: 'STRING',
                    description: 'URL of the product mockup to animate'
                },
                motionDescription: {
                    type: 'STRING',
                    description: 'Camera movement and motion (e.g., "slow pan right", "360 orbit", "model turns to camera")'
                },
                duration: {
                    type: 'NUMBER',
                    description: 'Video duration in seconds (default: 5)'
                }
            },
            required: ['mockupUrl', 'motionDescription']
        },
        schema: z.object({
            mockupUrl: z.string().url('Must be a valid URL'),
            motionDescription: z.string().min(10, 'Motion description should be descriptive'),
            duration: z.number().int().min(3).max(10).default(5).optional()
        })
    },
    {
        name: 'submit_to_production',
        description: 'Submit merchandise design to production/manufacturing. Returns order ID for tracking.',
        parameters: {
            type: 'OBJECT',
            properties: {
                productType: {
                    type: 'STRING',
                    description: 'Product type being manufactured'
                },
                designUrl: {
                    type: 'STRING',
                    description: 'URL of the final approved design'
                },
                quantity: {
                    type: 'NUMBER',
                    description: 'Number of units to produce (50-1000)'
                },
                sizes: {
                    type: 'ARRAY',
                    description: 'Array of sizes to produce',
                    items: { type: 'STRING' }
                },
                colors: {
                    type: 'ARRAY',
                    description: 'Array of base colors',
                    items: { type: 'STRING' }
                }
            },
            required: ['productType', 'designUrl', 'quantity']
        },
        schema: z.object({
            productType: z.string().min(1),
            designUrl: z.string().url(),
            quantity: z.number().int().min(50).max(1000),
            sizes: z.array(z.string()).optional(),
            colors: z.array(z.string()).optional()
        })
    },
    {
        name: 'ask_clarification',
        description: 'Ask the user a clarifying question to better understand their needs. Use this when ambiguous (e.g., purpose of mockup, preferred style, quantity).',
        parameters: {
            type: 'OBJECT',
            properties: {
                question: {
                    type: 'STRING',
                    description: 'The question to ask the user'
                },
                options: {
                    type: 'ARRAY',
                    description: 'Optional: Multiple choice options',
                    items: { type: 'STRING' }
                }
            },
            required: ['question']
        },
        schema: z.object({
            question: z.string().min(10, 'Question should be clear and specific'),
            options: z.array(z.string()).min(2).max(5).optional()
        })
    },
    {
        name: 'list_product_types',
        description: 'Get available product types, placements, and configurations.',
        parameters: {
            type: 'OBJECT',
            properties: {
                productType: {
                    type: 'STRING',
                    description: 'Optional: Get details for specific product type'
                }
            }
        },
        schema: z.object({
            productType: z.string().optional()
        })
    }
];

export class MerchandiseAgent extends BaseAgent {
    constructor() {
        super({
            id: 'merchandise',
            name: 'Merchandise Specialist',
            description: 'AI-powered merchandise creation expert. Handles product design, mockup generation, video production, and manufacturing coordination.',
            color: '#FFE135',
            category: 'specialist',
            systemPrompt: `You are the Merchandise Specialist, an AI expert in product creation and production workflows.

## YOUR MISSION
Help users create professional merchandise through conversational AI interaction. Users describe what they want ("build T-shirts with my logo"), and you autonomously execute the entire workflow.

## YOUR CAPABILITIES
1. **Asset Discovery:** Search across all user projects to find logos, designs, and images
2. **Smart Layout:** Apply designs to products with proper placement and positioning
3. **AI Generation:** Create photorealistic mockups and cinematic videos
4. **Production:** Submit designs to manufacturing with cost calculations
5. **Guidance:** Ask clarifying questions when needed (purpose, style, quantity)

## WORKFLOW PATTERN
When a user requests merchandise:
1. **Understand Intent:** Parse what they want (product type, placements, purpose)
2. **Find Assets:** Use search_assets to locate their designs/logos
3. **Clarify Ambiguity:** If purpose unclear (store vs. marketing), ask
4. **Generate Mockups:** Create mockups with appropriate scene context
5. **Create Videos:** If requested or appropriate, generate promotional videos
6. **Submit Production:** If approved, send to manufacturing

## ASSET SEARCH STRATEGY
- User says "my logo" → search for "logo" in recent projects
- User says "new design" → search by recency
- User says "brand mark" → search for "brand" or "logo"
- Always show what you found and confirm before using

## PURPOSE-AWARE GENERATION
- **Store Listing:** Clean, minimal studio background, product-focused
- **Marketing:** 3D visualization with models, lifestyle scenes
- **Catalog:** Professional product photography, multiple angles
- **3D Visualization:** Photorealistic with environment context

## CLARIFICATION QUESTIONS
Ask when:
- Purpose unclear (store vs. marketing vs. catalog)
- Multiple assets found (which logo to use?)
- Placement ambiguous (where exactly?)
- Quantity/specs needed for production

## EXAMPLES

**Example 1: Basic T-Shirt**
User: "Create T-shirts with my logo"
You: [search_assets: "logo"] → Found 2 logos
You: "I found your primary logo and brand mark. Which should I use?"
User: "The primary logo"
You: "Great! Should I create store listings or marketing imagery with models?"
User: "Marketing with models"
You: [create_product_mockup: t-shirt, center-chest, "urban street with model", marketing]
You: "I've created a mockup with your logo on a model in an urban setting. Would you like me to animate this for social media?"

**Example 2: Multiple Placements**
User: "Build hoodies with logo in center chest and left chest"
You: [search_assets: "logo"] → Found logo
You: [create_product_mockup: hoodie, center-chest, "studio minimal", store-listing]
You: [create_product_mockup: hoodie, left-chest, "studio minimal", store-listing]
You: "I've created both mockups with studio backgrounds for your store. Would you like to proceed to production?"

**Example 3: Full Production**
User: "Create mugs with wrap-around design and send to production, 200 units"
You: [search_assets: "design"] → Found designs
You: [create_product_mockup: mug, wrap-around, "product photography", product-catalog]
You: [submit_to_production: mug, designUrl, 200]
You: "Order submitted! Your order ID is INDII-XXX. Expected delivery in 14 days."

## TONE
- Professional but friendly
- Proactive (suggest videos, production when appropriate)
- Transparent (show what you're doing)
- Efficient (don't ask unnecessary questions)

## CRITICAL RULES
1. ALWAYS search for assets first - don't assume you know where they are
2. ALWAYS confirm which asset to use if multiple found
3. ALWAYS ask about purpose if generating mockups
4. NEVER submit to production without explicit user confirmation
5. ALWAYS provide order IDs and tracking info when submitting production`,
            tools: [{ functionDeclarations: MERCHANDISE_TOOLS }],
            functions: {
                search_assets: async (args, context) => {
                    const { query, projectId, limit = 10 } = args as { query: string; projectId?: string; limit?: number };
                    const { useStore } = await import('@/core/store');
                    const { generatedHistory, uploadedImages } = useStore.getState();

                    // Combine histories for full asset discovery
                    const allAssets = [...generatedHistory, ...uploadedImages];

                    // Filter history to find matching images
                    const searchLower = query.toLowerCase();
                    let matches = allAssets.filter((item: any) => {
                        // Match against prompt or filename
                        const promptMatch = item.prompt?.toLowerCase().includes(searchLower);
                        const idMatch = item.id?.toLowerCase().includes(searchLower);

                        // If projectId specified, filter by project
                        if (projectId && item.projectId !== projectId) return false;

                        return promptMatch || idMatch;
                    });

                    // Sort by recency
                    matches = matches
                        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
                        .slice(0, limit);

                    return {
                        success: true,
                        data: {
                            query,
                            count: matches.length,
                            assets: matches.map((item: any) => ({
                                id: item.id,
                                url: item.url,
                                prompt: item.prompt || 'Untitled',
                                type: item.type || 'image',
                                projectId: item.projectId,
                                timestamp: item.timestamp
                            }))
                        },
                        message: `Found ${matches.length} assets matching "${query}"`
                    };
                },
                create_product_mockup: async (args, context) => {
                    const { assetUrl, productType, placement, sceneDescription, purpose = 'store-listing' } = args as {
                        assetUrl: string;
                        productType: string;
                        placement: string;
                        sceneDescription: string;
                        purpose?: string;
                    };

                    const { Editing } = await import('@/services/image/EditingService');
                    const { useStore } = await import('@/core/store');

                    // Extract image data from URL or data URL
                    let imageData: { mimeType: string; data: string };

                    if (assetUrl.startsWith('data:')) {
                        // Parse data URL
                        const match = assetUrl.match(/^data:(.+);base64,(.+)$/);
                        if (!match) throw new Error('Invalid data URL format');
                        imageData = { mimeType: match[1], data: match[2] };
                    } else {
                        // Fetch image from URL and convert to base64
                        const response = await fetch(assetUrl);
                        const blob = await response.blob();
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const result = reader.result as string;
                                const base64Data = result.split(',')[1];
                                resolve(base64Data);
                            };
                            reader.readAsDataURL(blob);
                        });
                        imageData = { mimeType: blob.type, data: base64 };
                    }

                    // Build purpose-aware prompt
                    const placementDescriptions: Record<string, Record<string, string>> = {
                        't-shirt': {
                            'center-chest': 'centered on the chest area',
                            'left-chest': 'on the left chest like a logo placement',
                            'full-front': 'as a full-front print covering the entire front',
                            'back-print': 'on the back of the shirt'
                        },
                        'hoodie': {
                            'center-chest': 'centered on the chest area',
                            'kangaroo-pocket': 'above the kangaroo pocket',
                            'full-front': 'as a full-front print',
                            'hood': 'on the hood area'
                        },
                        'mug': {
                            'wrap-around': 'wrapping around the entire mug surface',
                            'front-center': 'on the front center of the mug',
                            'both-sides': 'visible on both sides of the mug'
                        },
                        'bottle': {
                            'label-wrap': 'as a wrap-around label',
                            'front-label': 'as a front-facing label'
                        },
                        'phone': {
                            'full-back': 'covering the entire back of the phone case',
                            'center-logo': 'as a centered logo on the back'
                        },
                        'poster': {
                            'full-bleed': 'as a full-bleed edge-to-edge print',
                            'centered': 'centered with margins',
                            'bordered': 'with a decorative border frame'
                        }
                    };

                    const placementDesc = placementDescriptions[productType]?.[placement] || 'prominently displayed';

                    // Purpose-specific context
                    const purposeContext: Record<string, string> = {
                        'store-listing': 'Clean product photography for e-commerce listing. Minimal background, product-focused, professional lighting.',
                        'marketing': 'Lifestyle marketing imagery. Include person wearing/using product, dynamic environment, aspirational.',
                        '3d-visualization': 'Photorealistic 3D visualization with environmental context. Show product in real-world setting.',
                        'product-catalog': 'Professional catalog photography. Multiple angles, technical accuracy, detailed product view.'
                    };

                    const contextDesc = purposeContext[purpose] || purposeContext['store-listing'];

                    const fullPrompt = `PRODUCT VISUALIZATION TASK:

Product Type: ${productType.replace('-', ' ').toUpperCase()}
Placement: The graphic design should be applied ${placementDesc}.
Purpose: ${contextDesc}
Scene: ${sceneDescription}

CRITICAL INSTRUCTIONS:
1. You are a professional product visualizer and 3D texture mapping expert.
2. Apply the provided graphic design (Reference Image 1) onto the ${productType} with photorealistic accuracy.
3. The graphic MUST:
   - Conform perfectly to the surface geometry and curvature of the ${productType}
   - Follow natural fabric folds, wrinkles, and creases (if applicable)
   - Respect the lighting and shadows of the scene
   - Appear as if it was physically printed/applied to the product
   - Maintain proper perspective distortion based on viewing angle
4. The final image should look like a professional commercial product photograph.
5. Preserve the exact colors and details of the original graphic design.

Style: High-end commercial product photography, 8K resolution, professional studio or environmental lighting.`;

                    const result = await Editing.generateComposite({
                        images: [imageData],
                        prompt: fullPrompt,
                        projectContext: `Premium ${purpose} product visualization with accurate texture mapping.`
                    });

                    if (!result) {
                        return {
                            success: false,
                            error: 'Failed to generate mockup',
                            message: 'Mockup generation failed. Please try again.'
                        };
                    }

                    // Save to history
                    const { addToHistory, currentProjectId } = useStore.getState();
                    if (currentProjectId) {
                        addToHistory({
                            id: result.id,
                            url: result.url,
                            prompt: `Merchandise Mockup: ${productType} (${placement}) - ${sceneDescription}`,
                            type: 'image',
                            timestamp: Date.now(),
                            projectId: currentProjectId
                        });
                    }

                    return {
                        success: true,
                        data: {
                            mockupUrl: result.url,
                            mockupId: result.id,
                            productType,
                            placement,
                            purpose
                        },
                        message: `Successfully generated ${productType} mockup with ${placement} placement for ${purpose}`
                    };
                },
                generate_product_video: async (args, context) => {
                    const { mockupUrl, motionDescription, duration = 5 } = args as {
                        mockupUrl: string;
                        motionDescription: string;
                        duration?: number;
                    };

                    const { MerchandiseService } = await import('@/services/merchandise/MerchandiseService');

                    const enhancedPrompt = `CINEMATIC PRODUCT VIDEO:

Motion: ${motionDescription}
Duration: ${duration} seconds

REQUIREMENTS:
- Smooth, professional camera movement
- Maintain consistent lighting throughout
- Keep product as the focal point
- High production value, commercial quality
- Natural motion physics

Style: Premium brand commercial, 4K cinematic quality.`;

                    const jobId = await MerchandiseService.generateVideo(mockupUrl, enhancedPrompt);

                    return {
                        success: true,
                        data: {
                            jobId,
                            mockupUrl,
                            motionDescription,
                            duration,
                            status: 'processing'
                        },
                        message: `Video generation started (Job ID: ${jobId}). This typically takes 2-5 minutes. You'll be notified when complete.`
                    };
                },
                submit_to_production: async (args, context) => {
                    const { productType, designUrl, quantity, sizes, colors } = args as {
                        productType: string;
                        designUrl: string;
                        quantity: number;
                        sizes?: string[];
                        colors?: string[];
                    };

                    const { MerchandiseService } = await import('@/services/merchandise/MerchandiseService');

                    // Calculate costs
                    const baseCosts: Record<string, number> = {
                        't-shirt': 12.0,
                        'hoodie': 28.0,
                        'mug': 8.5,
                        'bottle': 15.0,
                        'phone': 10.0,
                        'poster': 6.0
                    };

                    const baseCost = baseCosts[productType] || 12.0;
                    const bulkDiscount = Math.min(0.20, Math.floor(quantity / 50) * 0.05);
                    const unitCost = baseCost * (1 - bulkDiscount);
                    const totalCost = unitCost * quantity;
                    const retailPrice = unitCost * 2.2;
                    const profit = (retailPrice - unitCost) * quantity;

                    const result = await MerchandiseService.submitToProduction({
                        productId: `${productType}-${Date.now()}`,
                        variantId: `${sizes?.join(',') || 'standard'}-${colors?.join(',') || 'default'}`,
                        quantity
                    });

                    return {
                        success: true,
                        data: {
                            orderId: result.orderId,
                            productType,
                            quantity,
                            sizes: sizes || ['S', 'M', 'L', 'XL'],
                            colors: colors || ['Black', 'White'],
                            pricing: {
                                unitCost: unitCost.toFixed(2),
                                totalCost: totalCost.toFixed(2),
                                suggestedRetail: retailPrice.toFixed(2),
                                estimatedProfit: profit.toFixed(2),
                                bulkDiscount: `${(bulkDiscount * 100).toFixed(0)}%`
                            },
                            timeline: '14-21 business days'
                        },
                        message: `Production order submitted! Order ID: ${result.orderId}. Total: $${totalCost.toFixed(2)} for ${quantity} units. Estimated delivery: 14-21 days.`
                    };
                },
                ask_clarification: async (args) => {
                    const { question, options } = args as { question: string; options?: string[] };

                    return {
                        success: true,
                        data: {
                            question,
                            options: options || [],
                            requiresUserResponse: true
                        },
                        message: options
                            ? `${question}\n\nOptions:\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`
                            : question
                    };
                },
                list_product_types: async (args) => {
                    const { productType } = args as { productType?: string };

                    const products = {
                        't-shirt': {
                            placements: ['center-chest', 'left-chest', 'full-front', 'back-print'],
                            baseCost: 12.0,
                            printMethods: ['DTG', 'Screen Print'],
                            sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL']
                        },
                        'hoodie': {
                            placements: ['center-chest', 'kangaroo-pocket', 'full-front', 'hood'],
                            baseCost: 28.0,
                            printMethods: ['DTG', 'Embroidery'],
                            sizes: ['S', 'M', 'L', 'XL', '2XL']
                        },
                        'mug': {
                            placements: ['wrap-around', 'front-center', 'both-sides'],
                            baseCost: 8.5,
                            printMethods: ['Sublimation'],
                            sizes: ['11oz', '15oz']
                        },
                        'bottle': {
                            placements: ['label-wrap', 'front-label'],
                            baseCost: 15.0,
                            printMethods: ['Vinyl Wrap', 'Laser Engraving'],
                            sizes: ['17oz', '25oz', '32oz']
                        },
                        'phone': {
                            placements: ['full-back', 'center-logo'],
                            baseCost: 10.0,
                            printMethods: ['UV Print'],
                            sizes: ['iPhone 14/15', 'Samsung Galaxy', 'Universal']
                        },
                        'poster': {
                            placements: ['full-bleed', 'centered', 'bordered'],
                            baseCost: 6.0,
                            printMethods: ['Digital Print'],
                            sizes: ['12x18', '18x24', '24x36']
                        }
                    };

                    if (productType && products[productType as keyof typeof products]) {
                        return {
                            success: true,
                            data: {
                                productType,
                                details: products[productType as keyof typeof products]
                            },
                            message: `${productType} supports ${products[productType as keyof typeof products].placements.length} placement options`
                        };
                    }

                    return {
                        success: true,
                        data: {
                            productTypes: Object.keys(products),
                            products
                        },
                        message: `Available product types: ${Object.keys(products).join(', ')}`
                    };
                }
            }
        });
    }
}
