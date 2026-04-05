# Merchandise Studio Module (RC1)

The Merchandise module enables creators to turn digital assets into physical products. It provides a specialized design environment for creating apparel, accessories, and physical media, integrated with print-on-demand fulfillment.

## 👕 Key Features
- **Product Visualization:** Real-time mockups of designs on t-shirts, hoodies, vinyl covers, and more.
- **POD Integration:** Direct interface with providers like **Printful** for automated fulfillment and shipping.
- **Store Manager:** Centralized tracking of orders, customer data, and physical inventory.
- **Design Templates:** A library of production-ready templates for common merch items.
- **Visual Designer:** A specialized version of the Creative Studio canvas optimized for product layouts and print areas.

## 🏗️ Technical Architecture
- **`MerchDesigner`**: The core interactive UI for product creation.
- **`MerchandiseService`**: Manages the lifecycle of merch products and fulfillment orders.
- **`useCanvasHistory`**: Integrated undo/redo support for the design process.
- **Stripe Integration:** Secure handling of payments for direct-to-fan merch sales.

## 🔗 Integrations
- **Creative Studio:** High-res assets generated in the studio can be sent directly to the merch designer.
- **Finance Module:** Automated tracking of merch COGS (Cost of Goods Sold) and profit margins.
- **Marketing:** One-click generation of promo graphics featuring the artist's new merchandise.
