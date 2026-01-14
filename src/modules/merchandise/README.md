# Merchandise Module - Unified Product Creation & Production System

## Overview

The Merchandise module is a comprehensive, AI-powered system for designing merchandise, generating photorealistic product mockups, creating cinematic marketing videos, and submitting designs to manufacturing - all in one unified workflow.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Merchandise Module                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │   Designer   │  │   Catalog    │      │
│  │              │  │              │  │              │      │
│  │  • Stats     │  │  Design Mode │  │  • Standard  │      │
│  │  • Revenue   │  │  • Canvas    │  │  • Pro       │      │
│  │  • Sellers   │  │  • Assets    │  │  • Templates │      │
│  │              │  │  • Layers    │  │              │      │
│  │              │  │──────────────│  │              │      │
│  │              │  │ Showroom Mode│  │              │      │
│  │              │  │  • 4-Column  │  │              │      │
│  │              │  │  • AI Mockup │  │              │      │
│  │              │  │  • Video Gen │  │              │      │
│  │              │  │  • Manufact. │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Dashboard (`MerchDashboard.tsx`)

**Purpose:** Analytics overview and quick navigation

**Features:**
- User greeting with dynamic name
- Revenue metrics ("Total Revenue")
- Sales volume ("Units Sold")
- Conversion rate tracking
- Health Score (94/100) - overall health metric
- Sales Performance - week-over-week growth
- Top Sellers section with revenue breakdown
- Fresh Prints - recent design history
- "New Design" CTA button

### 2. Designer (`MerchDesigner.tsx`)

The Designer has **two modes** accessible via toggle:

#### Design Mode

**Purpose:** Create merchandise designs from scratch

**Layout:**
```
┌────────┬──────────────┬────────────┐
│ Assets │    Canvas    │ Properties │
│Library │              │            │
│        │  [DESIGN]    │  Layers    │
│ + + +  │   [HERE]     │  Blending  │
│ + + +  │              │  Opacity   │
│ + + +  │              │            │
└────────┴──────────────┴────────────┘
```

**Features:**
- **Left Panel:** Asset library with 9 placeholder slots
- **Tool Selection:** Stickers, Text, AI Gen
- **Center Canvas:** Design area with grid background and product preview
- **Right Panel:** Layers panel + Properties (Blend Mode, Opacity)
- **Toolbar:** Undo/Redo, Save Draft, Export

#### Showroom Mode

**Purpose:** AI-powered product photography and production workflow

**Layout:**
```
┌──────────┬──────────┬──────────┬──────────────┐
│ The Asset│ Scenario │The Stage │ Production   │
│          │          │          │              │
│ Upload   │ Scene    │ Preview  │ Item Spec    │
│ Product  │ Motion   │ Monitor  │ Colors       │
│ Type     │ Presets  │          │ Sizes        │
│ Placement│          │ Generate │ Quantity     │
│          │          │ Animate  │ Cost Calc    │
│          │          │          │ Submit       │
└──────────┴──────────┴──────────┴──────────────┘
```

**Column 1: The Asset (Input)**
- Asset upload with drag & drop
- File input (PNG with transparency recommended)
- Product type selector:
  - T-Shirt
  - Hoodie
  - Mug
  - Bottle
  - Phone Case
  - Poster
- Placement options per product type:
  - T-Shirt: Center Chest, Left Chest, Full Front, Back Print
  - Hoodie: Center Chest, Pocket Area, Full Front, Hood
  - Mug: Wrap Around, Front Center, Both Sides
  - Bottle: Label Wrap, Front Label
  - Phone: Full Back, Center Logo
  - Poster: Full Bleed, Centered, Bordered

**Column 2: The Scenario (Context)**
- **Scene Description:** Textarea for environment/setting prompt
- **Scene Presets (8):**
  - Studio Minimal
  - Urban Street
  - Nature
  - Cyberpunk
  - Beach Sunset
  - Industrial
  - Fashion Runway
  - Cozy Interior
- **Motion Description:** Textarea for camera movement (enabled after mockup)
- **Motion Presets (10):**
  - Slow Pan Right/Left
  - 360° Orbit
  - Zoom In/Out
  - Model Turn
  - Walk Forward
  - Dramatic Reveal
  - Gentle Breeze
  - Static Hero

**Column 3: The Stage (Output)**
- Preview monitor (video/image display)
- **Generate Mockup** button (requires asset + scene)
- **Animate Scene** button (requires mockup + motion)
- Loading overlay with spinner and progress messages
- Video playback controls

**Column 4: Production (Manufacturing)**
- Item spec selection (dropdown)
- Base color picker (4 options)
- Size run selection (XS-2XL)
- Quantity slider (50-1000 units)
- **Dynamic Cost Calculator:**
  - Base costs per product type
  - Bulk discount (5% per 50 units, max 20%)
  - Retail multiplier (2.2x markup)
  - Unit cost display
  - Retail price display
  - Profit estimation
- **Order Sample** button
- **Send to Production** button

### 3. Catalog (Standard & Pro Collections)

**Purpose:** Browse and clone product templates

**Standard Collection:**
- Bright, vibrant aesthetic
- Creamy yellow background (#FFF9E5)
- Light yellow surface colors (#FFEBA0)
- "MERCH COLLECTION" hero banner
- Grid display with hover animations
- "LATEST DROPS" section with category filters
- Flash Drops (Sunday 10AM EST)
- Artist Collabs banners

**Pro Collection:**
- Elite, minimalist aesthetic
- Black background with white accents
- Yellow-400 accent colors
- Glassmorphism effects with backdrop blur
- "MERCH PRO" with gradient text
- "THE CATALOGUE" with sourcing/shipping details
- Staggered grid layout (offset rows)
- "SECURE ITEM" buttons on hover
- "CERTIFIED PERFORMANCE" certification section

## Services

### MerchandiseService (`src/services/merchandise/MerchandiseService.ts`)

**Core Methods:**

```typescript
// Product Management
subscribeToProducts(userId: string, callback): Unsubscribe
getCatalog(): Promise<CatalogProduct[]>
createFromCatalog(catalogId, userId, customizations): Promise<string>
addProduct(product): Promise<string>
deleteProduct(productId): Promise<void>

// Production
submitToProduction(request: ManufactureRequest): Promise<{ success, orderId }>

// AI Generation
generateMockup(asset: string, type: string, scene: string): Promise<string>
generateVideo(mockupUrl: string, motion: string): Promise<string> // Returns jobId
subscribeToVideoJob(jobId: string, callback): Unsubscribe
```

**Key Features:**
- Firestore integration for persistence
- Secure Order ID generation using `crypto.getRandomValues()`
- Real AI mockup generation via ImageGenerationService
- Video generation via VideoGenerationService (Firebase Cloud Function)
- Job subscription pattern for async video rendering

### Enhanced Showroom Integration

**AI Services Used:**

1. **EditingService.generateComposite()** - For mockup generation
   - Professional texture mapping
   - Surface geometry conformity
   - Natural fabric folds simulation
   - Photorealistic lighting
   - Placement-aware prompts

2. **MerchandiseService.generateVideo()** - For video animation
   - Cloud Function: `triggerVideoJob`
   - Uses Veo 3.1 model
   - Real-time job subscription
   - First frame from mockup
   - Duration: 5 seconds default

## Data Types

### MerchProduct
```typescript
interface MerchProduct {
  id: string;
  userId: string;
  title: string;
  image: string;
  price: string;
  category: 'standard' | 'pro';
  tags?: string[];
  features?: string[];
  createdAt?: Timestamp;
}
```

### ManufactureRequest
```typescript
interface ManufactureRequest {
  productId: string;
  variantId: string;
  quantity: number;
  userId?: string;
  status?: 'pending' | 'processing' | 'completed';
  orderId?: string;
  createdAt?: any;
}
```

### CatalogProduct
```typescript
interface CatalogProduct extends MerchProduct {
  basePrice: number;
  description?: string;
}
```

## Firestore Collections

### `merchandise`
User's created products
```
{
  id: string
  userId: string
  title: string
  image: string (URL)
  price: string
  category: 'standard' | 'pro'
  tags: string[]
  features: string[]
  createdAt: Timestamp
}
```

### `merchandise_catalog`
Admin-managed product templates
```
{
  id: string
  title: string
  basePrice: number
  image: string (URL)
  tags: string[]
  features: string[]
  category: 'standard' | 'pro'
  description: string
}
```

### `manufacture_requests`
Production orders
```
{
  productId: string
  variantId: string
  quantity: number
  userId: string
  status: 'pending' | 'processing' | 'completed'
  orderId: string (format: BANA-XXXXXXXXXXXXX)
  createdAt: Timestamp
}
```

### `mockup_generations`
AI mockup tracking
```
{
  userId: string
  asset: string (ID or URL)
  type: string (product type)
  scene: string (prompt)
  status: 'processing' | 'completed' | 'failed'
  resultUrl?: string
  error?: string
  createdAt: Timestamp
}
```

### `videoJobs`
Video generation jobs
```
{
  jobId: string (UUID)
  prompt: string
  firstFrame: string (URL)
  duration: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
  orgId: string
  createdAt: Timestamp
}
```

## Theme System

### Standard Theme
```typescript
{
  primary: '#FFE135',        // Yellow
  secondary: '#FFEBA0',      // Light yellow
  background: '#FFF9E5',     // Creamy yellow
  text: '#4A4A4A',           // Dark gray
  accent: '#FF9800'          // Orange accent
}
```

### Pro Theme
```typescript
{
  primary: '#FFE135',        // Yellow
  secondary: '#1a1a1a',      // Near black
  background: '#000000',     // Pure black
  text: '#FFFFFF',           // White
  accent: '#facc15'          // Yellow-400
}
```

## Component Hierarchy

```
MerchStudio.tsx (Router)
├── MerchDashboard.tsx
│   ├── MerchCard
│   ├── MerchButton
│   └── StandardProductCard
│
├── MerchDesigner.tsx
│   ├── Layout
│   ├── MerchCard
│   ├── MerchButton
│   └── EnhancedShowroom
│       ├── ManufacturingPanel
│       └── (Asset/Scenario/Stage/Production columns)
│
└── Catalog Routes
    ├── StandardMerch (Standard)
    │   └── StandardProductCard (memoized)
    └── ProMerch (Pro)
        └── StandardProductCard (memoized)
```

## Hooks

### useMerchandise (`hooks/useMerchandise.ts`)

**Returns:**
```typescript
{
  products: MerchProduct[]          // All products
  standardProducts: MerchProduct[]  // Filtered by category
  proProducts: MerchProduct[]       // Filtered by category
  catalog: CatalogProduct[]         // Admin templates
  stats: {                          // Revenue & units
    revenue: number
    units: number
  }
  topSellingProducts: MerchProduct[] // Top 4 sellers
  loading: boolean                   // Combined loading state
  error: string | null               // Error messages
  addProduct: (product) => Promise<string>
  deleteProduct: (id) => Promise<void>
  createFromCatalog: (id, customizations) => Promise<string>
}
```

## User Workflow

### Complete Production Flow

1. **Dashboard** → View stats and recent designs
2. **Click "New Design"** → Enter Designer
3. **Design Mode:**
   - Select tools (Stickers/Text/AI Gen)
   - Add assets to canvas
   - Arrange layers
   - Adjust properties
   - Save draft (optional)
4. **Switch to Showroom Mode:**
   - Upload design asset (or continue with canvas export)
   - Select product type (e.g., T-Shirt)
   - Choose placement (e.g., Center Chest)
5. **Configure Scene:**
   - Type scene description OR select preset (e.g., "Studio Minimal")
   - Review scene prompt
6. **Generate Mockup:**
   - Click "Generate Mockup"
   - Wait for AI processing (~30-60 seconds)
   - View photorealistic product mockup
7. **Add Motion (Optional):**
   - Type motion description OR select preset (e.g., "Slow Pan Right")
   - Click "Animate Scene"
   - Wait for video rendering (~2-5 minutes)
   - View cinematic product video
8. **Configure Manufacturing:**
   - Select item spec (T-Shirt size specs)
   - Choose base color
   - Select size run (XS-2XL)
   - Adjust quantity (50-1000 units)
   - Review cost breakdown
9. **Submit to Production:**
   - Click "Order Sample" (for prototype) OR
   - Click "Send to Production" (for bulk order)
   - Receive secure Order ID (BANA-XXXXXXXXXXXXX)

## Mobile Responsive Design

**Desktop (≥1024px):**
- Full 4-column layout in Showroom mode
- Side-by-side panels in Design mode
- All features visible simultaneously

**Mobile (<1024px):**
- Showroom mode: 3-tab layout
  - **Tab 1:** Setup (Asset + Scenario)
  - **Tab 2:** The Stage (Preview + Actions)
  - **Tab 3:** Production (Manufacturing panel)
- Design mode: Stacked panels
- Collapsible sections for better space utilization

## Testing

### E2E Tests

**File:** `e2e/merchandise-unified-workflow.spec.ts`

**Test Cases:**
1. **Complete workflow:** Dashboard → Designer → Showroom → Mockup → Video → Production
2. **Design mode elements:** Assets, Layers, Properties, Tools, Canvas
3. **Showroom mode elements:** 4 columns, Product types, Presets, Actions
4. **Mobile responsive:** Tab switching, Layout adaptation

**File:** `e2e/merch-unified.spec.ts`

**Test Cases:**
1. Dashboard visibility (Ripeness/Performance metrics)
2. "Peel New Design" navigation
3. Design ↔ Showroom mode toggling
4. ScenarioBuilder component visibility
5. Generate Mockup button presence

## Security Features

### Secure Order ID Generation
```typescript
// ✅ CORRECT - Using crypto.getRandomValues()
const array = new Uint8Array(9);
crypto.getRandomValues(array);
const randomPart = Array.from(array, byte =>
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[byte % 36]
).join('');
const orderId = `BANA-${randomPart}`;

// ❌ WRONG - Using Math.random()
const orderId = `BANA-${Math.random().toString(36).slice(2)}`;
```

**Rationale:** `Math.random()` is predictable and can be exploited. `crypto.getRandomValues()` provides cryptographically secure randomness.

## Performance Optimizations

### Image Loading
```jsx
// Hero images
<img fetchPriority="high" />

// Below-fold images
<img loading="lazy" decoding="async" />
```

### Component Memoization
```typescript
// StandardProductCard uses memo with custom equality check
export default memo(StandardProductCard, (prevProps, nextProps) => {
  return prevProps.product.id === nextProps.product.id &&
         prevProps.product.price === nextProps.product.price;
});
```

### Constant Arrays
```typescript
// Define outside component to prevent reallocation
const STARS = ['★', '★', '★', '★', '★'];

function Component() {
  // Use STARS without recreating on each render
}
```

## Known Issues

### E2E Test Failures (Pre-Migration)
- Standard collection price test fails (text split across elements)
- Pro collection price test fails (same issue)
- **Fix:** Use selector refinement instead of full text match

### Video Generation Timing
- First video generation may be slow (~5-10 minutes) due to cold start
- Subsequent requests faster (~2-3 minutes)
- **Mitigation:** Show progress messages, allow background continuation

## Future Enhancements

### Planned Features
1. **Canvas Export:** Direct export from Design mode to Showroom asset
2. **Batch Production:** Submit multiple designs in one order
3. **Template Marketplace:** Share/sell custom templates
4. **Live Preview:** Real-time canvas updates on product mockup
5. **AR Preview:** View products in augmented reality
6. **Print-on-Demand Integration:** Direct fulfillment with Printful/Printify
7. **Inventory Management:** Track stock levels and reorders

### Technical Improvements
1. **Webhook Integration:** Real-time production status updates
2. **Cost API:** Dynamic pricing based on market rates
3. **Fulfillment Tracking:** Shipping and delivery status
4. **Analytics Dashboard:** Detailed sales and performance metrics
5. **A/B Testing:** Test different mockup styles and pricing

## Migration Notes

### From Separate Features to Unified Module

**Before:**
- Showroom scattered in Creative Studio (confusing UX)
- Basic merchandise feature with limited showroom mode
- Two incomplete implementations

**After:**
- Single unified merchandise module
- Clear user flow: Design → Showroom → Production
- All features in one place
- Creative Studio focused on image/video generation only

**Breaking Changes:**
- ✅ None - No changes to existing user data
- ✅ Firestore schema unchanged
- ✅ Backend services unchanged
- ✅ Existing products preserved

**Migration Steps:**
1. Removed Showroom from Creative Studio navigation
2. Removed Showroom component rendering from CreativeStudio.tsx
3. Updated `creativeSlice.ts` viewMode type (removed 'showroom')
4. Created `EnhancedShowroom.tsx` in merchandise module
5. Integrated EnhancedShowroom into MerchDesigner
6. Added proper video job subscription logic
7. Created new E2E tests for unified workflow

## Contributing

### Adding a New Product Type

1. Update `placementOptions` in `EnhancedShowroom.tsx`:
```typescript
'new-product': [
  { id: 'placement-1', label: 'Placement 1', icon: <Target size={14} /> },
  // ...
]
```

2. Update `getPlacementDescription()`:
```typescript
'new-product': {
  'placement-1': 'description of where design appears'
}
```

3. Add to `productTypes` array:
```typescript
{ id: 'new-product', label: 'New Product', icon: Icon }
```

### Adding a Scene Preset

```typescript
{
  label: 'Preset Name',
  prompt: 'Detailed scene description for AI'
}
```

### Adding a Motion Preset

```typescript
{
  id: 'preset-id',
  label: 'Preset Name',
  prompt: 'Camera movement description'
}
```

## License

Proprietary - Part of indiiOS platform

---

**Last Updated:** 2026-01-12
**Module Version:** 1.0.0 (Unified)
**Compatibility:** indiiOS v0.1.0-beta.2+
