import { logger } from '@/utils/logger';
/**
 * Print-on-Demand Service Abstraction Layer
 *
 * Provides a unified interface to multiple POD providers:
 * - Printful (primary, best for apparel)
 * - Printify (alternative, wide product range)
 * - Gooten (international shipping)
 *
 * Architecture follows the 3-layer pattern:
 * - This is the Execution layer (deterministic API calls)
 * - Orchestration layer decides which provider to use
 * - Directive layer defines the business rules
 */

import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

export const PODProviderSchema = z.enum(['printful', 'printify', 'gooten', 'internal']);
export type PODProvider = z.infer<typeof PODProviderSchema>;

export const PODProductSchema = z.object({
    id: z.string(),
    externalId: z.string(), // Provider's product ID
    provider: PODProviderSchema,
    name: z.string(),
    description: z.string().optional(),
    type: z.string(), // e.g., 'T-Shirt', 'Hoodie', 'Vinyl Record'
    basePrice: z.number(),
    currency: z.string().default('USD'),
    variants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        size: z.string().optional(),
        color: z.string().optional(),
        colorHex: z.string().optional(),
        price: z.number(),
        inStock: z.boolean().default(true)
    })),
    printAreas: z.array(z.object({
        id: z.string(),
        name: z.string(),
        width: z.number(), // in pixels at 300 DPI
        height: z.number()
    })),
    mockupTemplates: z.array(z.string()).optional(),
    imageUrl: z.string().url().optional()
});

export type PODProduct = z.infer<typeof PODProductSchema>;

export const PODOrderItemSchema = z.object({
    productId: z.string(),
    variantId: z.string(),
    quantity: z.number().min(1),
    designUrl: z.string().url(), // URL to the design image
    printArea: z.string().default('front'),
    mockupUrl: z.string().url().optional()
});

export type PODOrderItem = z.infer<typeof PODOrderItemSchema>;



export const PODShippingAddressSchema = z.object({
    name: z.string(),
    company: z.string().optional(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    stateCode: z.string(),
    countryCode: z.string(),
    postalCode: z.string(),
    phone: z.string().optional(),
    email: z.string().email().optional()
});

export type PODShippingAddress = z.infer<typeof PODShippingAddressSchema>;

export const PODOrderSchema = z.object({
    id: z.string().optional(),
    externalId: z.string().optional(), // Provider's order ID
    provider: PODProviderSchema,
    status: z.enum(['draft', 'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'failed']),
    items: z.array(PODOrderItemSchema),
    shippingAddress: PODShippingAddressSchema,
    shippingMethod: z.string().default('STANDARD'),
    subtotal: z.number(),
    shippingCost: z.number(),
    tax: z.number().default(0),
    total: z.number(),
    currency: z.string().default('USD'),
    trackingNumber: z.string().optional(),
    trackingUrl: z.string().url().optional(),
    estimatedDelivery: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
});

export type PODOrder = z.infer<typeof PODOrderSchema>;

export const PODShippingRateSchema = z.object({
    id: z.string(),
    name: z.string(),
    rate: z.number(),
    currency: z.string(),
    estimatedDays: z.string() // e.g., "3-5 business days"
});

export type PODShippingRate = z.infer<typeof PODShippingRateSchema>;

// ============================================================================
// Provider Interface
// ============================================================================

export interface IPODProvider {
    name: PODProvider;

    // Product Catalog
    getProducts(): Promise<PODProduct[]>;
    getProduct(productId: string): Promise<PODProduct | null>;
    searchProducts(query: string, type?: string): Promise<PODProduct[]>;

    // Pricing & Shipping
    calculatePrice(items: PODOrderItem[]): Promise<{ subtotal: number; breakdown: { itemId: string; price: number }[] }>;
    getShippingRates(address: PODShippingAddress, items: PODOrderItem[]): Promise<PODShippingRate[]>;

    // Orders
    createOrder(items: PODOrderItem[], address: PODShippingAddress, shippingMethod?: string): Promise<PODOrder>;
    getOrder(orderId: string): Promise<PODOrder | null>;
    cancelOrder(orderId: string): Promise<boolean>;

    // Mockups
    generateMockup(productId: string, variantId: string, designUrl: string, printArea?: string): Promise<string>;
}



// ============================================================================
// Printful Provider Implementation
// ============================================================================

class PrintfulProvider implements IPODProvider {
    name: PODProvider = 'printful';
    private apiKey: string;
    private baseUrl = 'https://api.printful.com';

    constructor(apiKey?: string) {
        this.apiKey = apiKey || import.meta.env.VITE_PRINTFUL_API_KEY || '';
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!this.apiKey) {
            throw new Error('Printful API key not configured. Set VITE_PRINTFUL_API_KEY in your environment.');
        }

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const { status } = response;
                const errorBody = await response.json().catch(() => ({ message: response.statusText }));
                const message = errorBody?.error?.message || errorBody?.message || response.statusText;

                // 429 Too Many Requests & 5xx transient errors → retry with backoff
                if (status === 429 || status === 502 || status === 503 || status === 504) {
                    attempt++;
                    if (attempt >= maxRetries) {
                        const label = status === 429 ? 'Rate limited' : `Server error (${status})`;
                        throw new Error(`Printful API ${label} after ${maxRetries} retries: ${message}`);
                    }
                    const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
                    logger.warn(`[Printful] ${status} on ${endpoint}. Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    continue;
                }

                // 413 Payload Too Large → design file is too big
                if (status === 413) {
                    throw new Error(`Printful API error: Design file too large. Please reduce image size and try again. (413 Payload Too Large)`);
                }

                // 422 Unprocessable Entity → validation issue on Printful's side
                if (status === 422) {
                    throw new Error(`Printful API validation error (422): ${message}. Check that all required fields are present and valid.`);
                }

                // 401 Unauthorized → bad API key
                if (status === 401) {
                    throw new Error(`Printful API authentication failed (401): Invalid API key. Please check VITE_PRINTFUL_API_KEY.`);
                }

                // 403 Forbidden → insufficient permissions
                if (status === 403) {
                    throw new Error(`Printful API permission denied (403): ${message}. Check API key scope.`);
                }

                // 404 Not Found → resource doesn't exist
                if (status === 404) {
                    throw new Error(`Printful API resource not found (404): ${endpoint} - ${message}`);
                }

                // Generic fallback for all other 4xx/5xx
                throw new Error(`Printful API error (${status}): ${message}`);
            }

            const data = await response.json();
            return data.result;
        }
        throw new Error('Printful API request failed after retries');
    }

    async getProducts(): Promise<PODProduct[]> {
        const products = await this.request<any[]>('/store/products');
        return products.map(p => this.mapProduct(p));
    }

    async getProduct(productId: string): Promise<PODProduct | null> {
        try {
            const product = await this.request<any>(`/store/products/${productId}`);
            return this.mapProduct(product);
        } catch {
            return null;
        }
    }

    async searchProducts(query: string, type?: string): Promise<PODProduct[]> {
        // Printful doesn't have a direct search API, so we filter locally
        const products = await this.getProducts();
        return products.filter(p => {
            const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
            const matchesType = !type || p.type.toLowerCase() === type.toLowerCase();
            return matchesQuery && matchesType;
        });
    }

    async calculatePrice(items: PODOrderItem[]): Promise<{ subtotal: number; breakdown: { itemId: string; price: number }[] }> {
        const result = await this.request<any>('/orders/estimate-costs', {
            method: 'POST',
            body: JSON.stringify({
                items: items.map(item => ({
                    sync_variant_id: item.variantId,
                    quantity: item.quantity,
                    files: [{ url: item.designUrl }]
                }))
            })
        });

        return {
            subtotal: result.costs?.subtotal || 0,
            breakdown: items.map((item, i) => ({
                itemId: item.productId,
                price: result.breakdown?.[i]?.cost || 0
            }))
        };
    }

    async getShippingRates(address: PODShippingAddress, items: PODOrderItem[]): Promise<PODShippingRate[]> {
        const result = await this.request<any[]>('/shipping/rates', {
            method: 'POST',
            body: JSON.stringify({
                recipient: {
                    address1: address.address1,
                    city: address.city,
                    state_code: address.stateCode,
                    country_code: address.countryCode,
                    zip: address.postalCode
                },
                items: items.map(item => ({
                    sync_variant_id: item.variantId,
                    quantity: item.quantity
                }))
            })
        });

        return result.map(rate => ({
            id: rate.id,
            name: rate.name,
            rate: parseFloat(rate.rate),
            currency: rate.currency,
            estimatedDays: `${rate.minDeliveryDays}-${rate.maxDeliveryDays} business days`
        }));
    }

    async createOrder(items: PODOrderItem[], address: PODShippingAddress, shippingMethod = 'STANDARD'): Promise<PODOrder> {
        const result = await this.request<any>('/orders', {
            method: 'POST',
            body: JSON.stringify({
                recipient: {
                    name: address.name,
                    company: address.company,
                    address1: address.address1,
                    address2: address.address2,
                    city: address.city,
                    state_code: address.stateCode,
                    country_code: address.countryCode,
                    zip: address.postalCode,
                    phone: address.phone,
                    email: address.email
                },
                items: items.map(item => ({
                    sync_variant_id: item.variantId,
                    quantity: item.quantity,
                    files: [{
                        url: item.designUrl,
                        position: item.printArea
                    }]
                })),
                shipping: shippingMethod
            })
        });

        return this.mapOrder(result);
    }

    async getOrder(orderId: string): Promise<PODOrder | null> {
        try {
            const result = await this.request<any>(`/orders/${orderId}`);
            return this.mapOrder(result);
        } catch {
            return null;
        }
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        try {
            await this.request(`/orders/${orderId}`, { method: 'DELETE' });
            return true;
        } catch {
            return false;
        }
    }

    async generateMockup(productId: string, variantId: string, designUrl: string, printArea = 'front'): Promise<string> {
        const result = await this.request<any>('/mockup-generator/create-task', {
            method: 'POST',
            body: JSON.stringify({
                variant_ids: [parseInt(variantId)],
                files: [{
                    placement: printArea,
                    image_url: designUrl
                }]
            })
        });

        // Poll for completion
        const taskId = result.task_key;
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const status = await this.request<any>(`/mockup-generator/task?task_key=${taskId}`);

            if (status.status === 'completed') {
                return status.mockups?.[0]?.mockup_url || '';
            }

            if (status.status === 'failed') {
                throw new Error('Mockup generation failed');
            }

            attempts++;
        }

        throw new Error('Mockup generation timed out');
    }

    private mapProduct(raw: any): PODProduct {
        return {
            id: String(raw.id),
            externalId: String(raw.external_id || raw.id),
            provider: 'printful',
            name: raw.name,
            description: raw.description,
            type: raw.type_name || raw.type || 'Unknown',
            basePrice: raw.retail_price || 0,
            currency: 'USD',
            variants: (raw.sync_variants || raw.variants || []).map((v: any) => ({
                id: String(v.id),
                name: v.name,
                size: v.size,
                color: v.color,
                colorHex: v.color_code,
                price: v.retail_price || raw.retail_price || 0,
                inStock: v.availability_status !== 'out_of_stock'
            })),
            printAreas: [
                { id: 'front', name: 'Front', width: 4500, height: 5400 },
                { id: 'back', name: 'Back', width: 4500, height: 5400 }
            ],
            imageUrl: raw.thumbnail_url
        };
    }

    private mapOrder(raw: any): PODOrder {
        return {
            id: String(raw.id),
            externalId: raw.external_id,
            provider: 'printful',
            status: this.mapOrderStatus(raw.status),
            items: (raw.items || []).map((item: any) => ({
                productId: String(item.sync_product_id),
                variantId: String(item.sync_variant_id),
                quantity: item.quantity,
                designUrl: item.files?.[0]?.url || '',
                printArea: item.files?.[0]?.position || 'front'
            })),
            shippingAddress: {
                name: raw.recipient?.name || '',
                company: raw.recipient?.company,
                address1: raw.recipient?.address1 || '',
                address2: raw.recipient?.address2,
                city: raw.recipient?.city || '',
                stateCode: raw.recipient?.state_code || '',
                countryCode: raw.recipient?.country_code || '',
                postalCode: raw.recipient?.zip || '',
                phone: raw.recipient?.phone,
                email: raw.recipient?.email
            },
            shippingMethod: raw.shipping,
            subtotal: raw.costs?.subtotal || 0,
            shippingCost: raw.costs?.shipping || 0,
            tax: raw.costs?.tax || 0,
            total: raw.costs?.total || 0,
            currency: 'USD',
            trackingNumber: raw.shipments?.[0]?.tracking_number,
            trackingUrl: raw.shipments?.[0]?.tracking_url,
            createdAt: raw.created,
            updatedAt: raw.updated
        };
    }

    private mapOrderStatus(status: string): PODOrder['status'] {
        const statusMap: Record<string, PODOrder['status']> = {
            'draft': 'draft',
            'pending': 'pending',
            'failed': 'failed',
            'canceled': 'cancelled',
            'inprocess': 'processing',
            'onhold': 'processing',
            'partial': 'processing',
            'fulfilled': 'shipped'
        };
        return statusMap[status] || 'pending';
    }
}

// ============================================================================
// Internal Provider (Fallback when no POD configured)
// ============================================================================

class InternalProvider implements IPODProvider {
    name: PODProvider = 'internal';

    async getProducts(): Promise<PODProduct[]> {
        // Return placeholder products for demo/development
        return [
            {
                id: 'internal-tshirt',
                externalId: 'internal-tshirt',
                provider: 'internal',
                name: 'Premium T-Shirt',
                description: 'High-quality cotton t-shirt',
                type: 'T-Shirt',
                basePrice: 12.50,
                currency: 'USD',
                variants: [
                    { id: 's-black', name: 'Small Black', size: 'S', color: 'Black', colorHex: '#000000', price: 12.50, inStock: true },
                    { id: 'm-black', name: 'Medium Black', size: 'M', color: 'Black', colorHex: '#000000', price: 12.50, inStock: true },
                    { id: 'l-black', name: 'Large Black', size: 'L', color: 'Black', colorHex: '#000000', price: 12.50, inStock: true },
                    { id: 's-white', name: 'Small White', size: 'S', color: 'White', colorHex: '#FFFFFF', price: 12.50, inStock: true },
                    { id: 'm-white', name: 'Medium White', size: 'M', color: 'White', colorHex: '#FFFFFF', price: 12.50, inStock: true },
                    { id: 'l-white', name: 'Large White', size: 'L', color: 'White', colorHex: '#FFFFFF', price: 12.50, inStock: true }
                ],
                printAreas: [
                    { id: 'front', name: 'Front', width: 4500, height: 5400 },
                    { id: 'back', name: 'Back', width: 4500, height: 5400 }
                ]
            },
            {
                id: 'internal-hoodie',
                externalId: 'internal-hoodie',
                provider: 'internal',
                name: 'Premium Hoodie',
                description: 'Comfortable cotton-blend hoodie',
                type: 'Hoodie',
                basePrice: 24.00,
                currency: 'USD',
                variants: [
                    { id: 's-black', name: 'Small Black', size: 'S', color: 'Black', colorHex: '#000000', price: 24.00, inStock: true },
                    { id: 'm-black', name: 'Medium Black', size: 'M', color: 'Black', colorHex: '#000000', price: 24.00, inStock: true },
                    { id: 'l-black', name: 'Large Black', size: 'L', color: 'Black', colorHex: '#000000', price: 24.00, inStock: true }
                ],
                printAreas: [
                    { id: 'front', name: 'Front', width: 4500, height: 5400 },
                    { id: 'back', name: 'Back', width: 4500, height: 5400 }
                ]
            },
            {
                id: 'internal-vinyl',
                externalId: 'internal-vinyl',
                provider: 'internal',
                name: '12" Vinyl Record',
                description: 'Premium pressed vinyl with custom sleeve',
                type: 'Vinyl Record',
                basePrice: 18.00,
                currency: 'USD',
                variants: [
                    { id: 'black-vinyl', name: 'Black Vinyl', color: 'Black', colorHex: '#000000', price: 18.00, inStock: true },
                    { id: 'clear-vinyl', name: 'Clear Vinyl', color: 'Clear', colorHex: '#FFFFFF', price: 20.00, inStock: true },
                    { id: 'color-vinyl', name: 'Colored Vinyl', color: 'Custom', colorHex: '#FFE135', price: 22.00, inStock: true }
                ],
                printAreas: [
                    { id: 'center-label', name: 'Center Label', width: 1200, height: 1200 },
                    { id: 'sleeve-front', name: 'Sleeve Front', width: 3600, height: 3600 },
                    { id: 'sleeve-back', name: 'Sleeve Back', width: 3600, height: 3600 }
                ]
            }
        ];
    }

    async getProduct(productId: string): Promise<PODProduct | null> {
        const products = await this.getProducts();
        return products.find(p => p.id === productId) || null;
    }

    async searchProducts(query: string, type?: string): Promise<PODProduct[]> {
        const products = await this.getProducts();
        return products.filter(p => {
            const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
            const matchesType = !type || p.type.toLowerCase() === type.toLowerCase();
            return matchesQuery && matchesType;
        });
    }

    async calculatePrice(items: PODOrderItem[]): Promise<{ subtotal: number; breakdown: { itemId: string; price: number }[] }> {
        const products = await this.getProducts();
        let subtotal = 0;
        const breakdown: { itemId: string; price: number }[] = [];

        for (const item of items) {
            const product = products.find(p => p.id === item.productId);
            const variant = product?.variants.find(v => v.id === item.variantId);
            const price = (variant?.price || product?.basePrice || 10) * item.quantity;
            subtotal += price;
            breakdown.push({ itemId: item.productId, price });
        }

        return { subtotal, breakdown };
    }

    async getShippingRates(_address: PODShippingAddress, _items: PODOrderItem[]): Promise<PODShippingRate[]> {
        // Return placeholder rates
        return [
            { id: 'standard', name: 'Standard Shipping', rate: 4.99, currency: 'USD', estimatedDays: '5-7 business days' },
            { id: 'express', name: 'Express Shipping', rate: 12.99, currency: 'USD', estimatedDays: '2-3 business days' },
            { id: 'overnight', name: 'Overnight Shipping', rate: 24.99, currency: 'USD', estimatedDays: '1 business day' }
        ];
    }

    async createOrder(items: PODOrderItem[], address: PODShippingAddress, shippingMethod = 'standard'): Promise<PODOrder> {
        const pricing = await this.calculatePrice(items);
        const shipping = await this.getShippingRates(address, items);
        const selectedShipping = shipping.find(s => s.id === shippingMethod) || shipping[0];

        // Generate secure order ID
        const array = new Uint8Array(9);
        crypto.getRandomValues(array);
        const orderId = Array.from(array, byte => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[byte % 36]).join('');

        return {
            id: `INT-${orderId}`,
            provider: 'internal',
            status: 'pending',
            items,
            shippingAddress: address,
            shippingMethod,
            subtotal: pricing.subtotal,
            shippingCost: selectedShipping.rate,
            tax: 0,
            total: pricing.subtotal + selectedShipping.rate,
            currency: 'USD',
            estimatedDelivery: selectedShipping.estimatedDays,
            createdAt: new Date().toISOString()
        };
    }

    async getOrder(_orderId: string): Promise<PODOrder | null> {
        // In a real implementation, this would fetch from Firestore
        return null;
    }

    async cancelOrder(_orderId: string): Promise<boolean> {
        // In a real implementation, this would update Firestore
        return true;
    }

    async generateMockup(productId: string, variantId: string, designUrl: string, printArea = 'front'): Promise<string> {
        try {
            const product = await this.getProduct(productId);
            const variant = product?.variants.find(v => v.id === variantId);
            const color = variant?.color || 'black';
            const type = product?.type || 'T-Shirt';

            logger.debug(`[InternalPOD] Generating AI Mockup for ${type} (${color}) at ${printArea}`);

            // 1. Convert Design URL to Base64 (if possible/needed) or pass as URL
            // The agent tool IndiiImageEdit expects image_bytes. 
            // We need to fetch the design first or pass the URL if the tool supports it.
            // For now, we'll try to fetch it if it's a remote URL.

            let imageBytes = '';
            if (designUrl.startsWith('data:')) {
                imageBytes = designUrl.split(',')[1];
            } else {
                try {
                    const response = await fetch(designUrl);
                    const blob = await response.blob();
                    const buffer = await blob.arrayBuffer();
                    imageBytes = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                } catch (e) {
                    logger.warn(`[InternalPOD] Failed to fetch design for base64 conversion, using fallback URL logic`, e);
                    return designUrl; // Fallback
                }
            }

            // AI mockup generation via Firebase Cloud Function
            const { httpsCallable } = await import('firebase/functions');
            const { functionsWest1: functions } = await import('@/services/firebase');
            const editImageFn = httpsCallable(functions, 'editImage');

            const prompt = `A cinematic studio mockup of a ${color} ${type}. The provided design is overlayed ${printArea === 'front' ? 'on the chest' : 'on the back'} with professional high-quality print texture. Hyper-realistic, 4k, retail presentation.`;

            const result = await editImageFn({
                image: imageBytes,
                prompt,
            }) as { data: { url?: string; visual?: string } };

            const url = result.data?.url || result.data?.visual;
            if (url) return url;

            return designUrl; // Fallback
        } catch (error) {
            logger.error('[InternalPOD] AI Mockup generation error:', error);
            return designUrl; // Fallback
        }
    }
}

// ============================================================================
// Main Service (Provider Orchestration)
// ============================================================================

class PrintOnDemandServiceClass {
    private providers: Map<PODProvider, IPODProvider> = new Map();
    private defaultProvider: PODProvider = 'internal';

    constructor() {
        // Register providers
        this.registerProvider(new InternalProvider());

        // Only register Printful if API key is configured
        if (import.meta.env.VITE_PRINTFUL_API_KEY) {
            this.registerProvider(new PrintfulProvider());
            this.defaultProvider = 'printful';
        }
    }

    registerProvider(provider: IPODProvider): void {
        this.providers.set(provider.name, provider);
    }

    getProvider(name?: PODProvider): IPODProvider {
        const providerName = name || this.defaultProvider;
        const provider = this.providers.get(providerName);

        if (!provider) {
            logger.warn(`[POD] Provider ${providerName} not found, falling back to internal`);
            return this.providers.get('internal')!;
        }

        return provider;
    }

    getAvailableProviders(): PODProvider[] {
        return Array.from(this.providers.keys());
    }

    isConfigured(provider: PODProvider): boolean {
        return this.providers.has(provider) && provider !== 'internal';
    }

    // Convenience methods that use the default provider
    async getProducts(provider?: PODProvider): Promise<PODProduct[]> {
        return this.getProvider(provider).getProducts();
    }

    async getProduct(productId: string, provider?: PODProvider): Promise<PODProduct | null> {
        return this.getProvider(provider).getProduct(productId);
    }

    async searchProducts(query: string, type?: string, provider?: PODProvider): Promise<PODProduct[]> {
        return this.getProvider(provider).searchProducts(query, type);
    }

    async calculatePrice(items: PODOrderItem[], provider?: PODProvider): Promise<{ subtotal: number; breakdown: { itemId: string; price: number }[] }> {
        return this.getProvider(provider).calculatePrice(items);
    }

    async getShippingRates(address: PODShippingAddress, items: PODOrderItem[], provider?: PODProvider): Promise<PODShippingRate[]> {
        return this.getProvider(provider).getShippingRates(address, items);
    }

    async createOrder(items: PODOrderItem[], address: PODShippingAddress, shippingMethod?: string, provider?: PODProvider): Promise<PODOrder> {
        return this.getProvider(provider).createOrder(items, address, shippingMethod);
    }

    async getOrder(orderId: string, provider?: PODProvider): Promise<PODOrder | null> {
        return this.getProvider(provider).getOrder(orderId);
    }

    async cancelOrder(orderId: string, provider?: PODProvider): Promise<boolean> {
        return this.getProvider(provider).cancelOrder(orderId);
    }

    async generateMockup(productId: string, variantId: string, designUrl: string, printArea?: string, provider?: PODProvider): Promise<string> {
        return this.getProvider(provider).generateMockup(productId, variantId, designUrl, printArea);
    }
}

// Export singleton instance
export const PrintOnDemandService = new PrintOnDemandServiceClass();


