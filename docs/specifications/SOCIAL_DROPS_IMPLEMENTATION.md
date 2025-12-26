# Social Drops & Marketplace Integration

**Status:** Planned
**Priority:** High
**Last Updated:** 2025-12-26

---

## Overview

This document outlines the next phase of the Marketplace integration: enabling "Social Drops" - a feature where artists can embed products directly in their social feed posts, allowing fans to discover and purchase items seamlessly.

---

## Phase 1: Deepen Integration (Social Drops)

### Goal

Complete the loop: **Artist creates product → Artist posts about it → Fan buys it from feed**

### Current State

- `SocialFeed.tsx` renders posts but does not handle embedded products
- `ProductCard.tsx` exists for marketplace display
- `MerchTable` handles product creation/management

### Required Changes

#### 1.1 Update Post Schema

Add optional `productId` field to social posts:

```typescript
interface SocialPost {
    id: string;
    authorId: string;
    content: string;
    mediaUrls?: string[];
    productId?: string;  // NEW: Reference to a marketplace product
    createdAt: Timestamp;
    likes: number;
    comments: Comment[];
}
```

#### 1.2 Update SocialFeed.tsx

**File:** `src/modules/social/SocialFeed.tsx`

- Detect when a post contains a `productId`
- Render an embedded `ProductCard` within the post
- Add "Shop Now" or "Buy" CTA that links to checkout
- Show product price and availability inline

```tsx
// Pseudo-implementation
{post.productId && (
    <div className="mt-4 border-t border-white/10 pt-4">
        <ProductCard
            productId={post.productId}
            variant="embedded"
            onPurchase={handleQuickPurchase}
        />
    </div>
)}
```

#### 1.3 Add "Attach Product" to Post Composer

**File:** `src/modules/social/PostComposer.tsx`

- Add product picker modal
- Show selected product preview before posting
- Validate product exists and is active

#### 1.4 Create ProductCard Embedded Variant

**File:** `src/modules/marketplace/ProductCard.tsx`

- Add `variant="embedded"` prop
- Compact layout for feed display
- Quick purchase button (1-click if payment method saved)

---

## Phase 2: Finance Dashboard

### Goal

Provide artists with real-time revenue tracking from marketplace sales.

### Components to Create

#### 2.1 Revenue Dashboard View

**File:** `src/modules/dashboard/components/RevenueView.tsx`

- Total revenue (all time)
- Revenue this period (week/month/year)
- Revenue by product breakdown
- Revenue by source (direct vs. social drops)

#### 2.2 Sales Analytics

**File:** `src/modules/dashboard/components/SalesAnalytics.tsx`

- Sales over time chart
- Conversion rate (views → purchases)
- Top performing products
- Top performing social drops

#### 2.3 Mock Revenue Service

**File:** `src/services/RevenueService.ts`

```typescript
interface RevenueEntry {
    id: string;
    productId: string;
    amount: number;
    source: 'direct' | 'social_drop';
    customerId: string;
    timestamp: Timestamp;
}

class RevenueServiceImpl {
    async getTotalRevenue(userId: string): Promise<number>;
    async getRevenueByPeriod(userId: string, start: Date, end: Date): Promise<number>;
    async getRevenueByProduct(userId: string): Promise<Map<string, number>>;
    async recordSale(entry: Omit<RevenueEntry, 'id'>): Promise<void>;
}
```

#### 2.4 Dashboard Integration

- Add "Revenue" card to main dashboard
- Show gamified progress (e.g., "50% to first $1000!")
- Weekly/monthly revenue goals

---

## Phase 3: Refine "The Merchant" Tests

### Goal

Expand E2E test coverage for the full social drop interaction flow.

### Test Scenarios

#### 3.1 Product Creation Flow

**File:** `e2e/merchant-product-creation.spec.ts`

```typescript
test('artist can create a product', async ({ page }) => {
    // Navigate to MerchTable
    // Fill product form (name, price, description, image)
    // Submit and verify product appears in catalog
});
```

#### 3.2 Social Drop Posting Flow

**File:** `e2e/merchant-social-drop.spec.ts`

```typescript
test('artist can attach product to post', async ({ page }) => {
    // Open post composer
    // Click "Attach Product"
    // Select product from picker
    // Verify product preview shows
    // Submit post
    // Verify post appears with embedded product
});
```

#### 3.3 Fan Purchase Flow

**File:** `e2e/merchant-purchase.spec.ts`

```typescript
test('fan can purchase from social drop', async ({ page }) => {
    // View social feed
    // Find post with embedded product
    // Click "Buy" button
    // Complete checkout flow
    // Verify order confirmation
    // Verify seller revenue updated
});
```

#### 3.4 Revenue Tracking Verification

**File:** `e2e/merchant-revenue.spec.ts`

```typescript
test('revenue updates after sale', async ({ page }) => {
    // Complete a purchase as fan
    // Switch to seller account
    // Navigate to revenue dashboard
    // Verify sale appears in recent transactions
    // Verify total revenue increased
});
```

---

## Implementation Order

| Step | Task | Effort | Dependencies |
|------|------|--------|--------------|
| 1 | Update Post schema with productId | Low | None |
| 2 | Create ProductCard embedded variant | Medium | Step 1 |
| 3 | Update SocialFeed to render drops | Medium | Step 2 |
| 4 | Add product picker to PostComposer | Medium | Step 2 |
| 5 | Create RevenueService | Medium | None |
| 6 | Build RevenueView dashboard | High | Step 5 |
| 7 | Integrate revenue in main dashboard | Low | Step 6 |
| 8 | Write E2E tests | Medium | Steps 1-7 |

---

## Success Metrics

1. **Social Drop Conversion:** 5%+ of social drop views result in product page visits
2. **Purchase Completion:** 20%+ of product page visits from drops result in purchase
3. **Revenue Visibility:** Artists check revenue dashboard 3+ times per week
4. **Test Coverage:** 100% of happy path flows covered by E2E tests

---

## Files to Create/Modify

### New Files

- `src/services/RevenueService.ts`
- `src/modules/dashboard/components/RevenueView.tsx`
- `src/modules/dashboard/components/SalesAnalytics.tsx`
- `e2e/merchant-product-creation.spec.ts`
- `e2e/merchant-social-drop.spec.ts`
- `e2e/merchant-purchase.spec.ts`
- `e2e/merchant-revenue.spec.ts`

### Modified Files

- `src/modules/social/SocialFeed.tsx` - Add product rendering
- `src/modules/social/PostComposer.tsx` - Add product attachment
- `src/modules/marketplace/ProductCard.tsx` - Add embedded variant
- `src/modules/dashboard/Dashboard.tsx` - Add revenue widget

---

## Notes

- Mock revenue for now (no real payment processing)
- Use Firestore for revenue tracking (path: `users/{userId}/revenue/{entryId}`)
- Consider adding "Featured Drop" promotion for Pro tier users
- Social drops should respect MembershipService limits (e.g., free tier = 1 drop/day)
