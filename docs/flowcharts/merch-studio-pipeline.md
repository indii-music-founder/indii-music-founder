# Merch Studio Pipeline Flowchart

This flowchart maps the indii Merch Studio—a Fabric.js-powered design canvas where artists create merchandise designs with AI-assisted mockups, and ship products via print-on-demand distributors (Teespring, Printful, etc.).

```mermaid
graph TD
    %% UI Layer
    subgraph UI ["Merch Studio UI"]
        Canvas["Fabric.js Canvas (Editable Design)"]
        Templates["Template Library (Shirts, Hoodies, Bags)"]
        MockupPreview["Mockup Preview (Photo-realistic)"]
        ProductSettings["Product Settings (SKU, Pricing, Variants)"]
    end

    %% AI Design Layer
    subgraph AIDesign ["AI-Assisted Design"]
        PromptInput["User Design Prompt (e.g., 'neon band logo')"]
        CreativeAgent["CreativeAgent (Design Intent)"]
        GenerateImage["Gemini 3.1 Image Generation"]
        PlaceAsset["Place Generated Asset on Canvas"]
    end

    %% Canvas State
    subgraph CanvasState ["Canvas State Management"]
        MerchSlice["Zustand `merch Store`"]
        FabricObjects["Fabric.js Object State (SVG/Raster)"]
    end

    %% Production & Distribution
    subgraph Production ["Production & Distribution"]
        DraftProduct["Draft Product (Firestore)"]
        PODConnector["Print-on-Demand Connector (API)"]
        PODServices["Teespring / Printful / Redbubble"]
        Inventory["Live Inventory & Orders"]
    end

    %% Data & Persistence
    subgraph Data ["Data & Persistence"]
        FS["Firestore (`merch`, `designs`, `products`)"]
        CS["Cloud Storage (Design Assets)"]
        Stripe["Stripe (Per-item Revenue Split)"]
    end

    %% Workflow
    Templates -->|"Select Base"| Canvas
    PromptInput -->|"Describe Design"| CreativeAgent
    CreativeAgent -->|"Intent → Prompt"| GenerateImage
    GenerateImage -->|"Raster Image"| PlaceAsset
    PlaceAsset -->|"Add to Layer Stack"| Canvas
    
    Canvas -->|"User Edits (Move, Resize, Rotate)"| FabricObjects
    FabricObjects <-->|"Hydrates UI State"| MerchSlice
    MockupPreview -->|"Renders Product Mockup"| FabricObjects
    
    MerchSlice -->|"Saves Draft"| DraftProduct
    DraftProduct -->|"Stores in"| FS
    Canvas -->|"Exports SVG/PDF"| CS
    
    ProductSettings -->|"Set Price, Variants"| MerchSlice
    MerchSlice -->|"Finalize Product"| PODConnector
    PODConnector -->|"Push Design + Metadata"| PODServices
    PODServices -->|"Live Store"| Inventory
    Inventory -->|"Order Webhooks"| Stripe
    Stripe -->|"Log Revenue"| FS

    %% Styling
    style Canvas fill:#00D4FF,color:#000
    style Templates fill:#00D4FF,color:#000
    style MockupPreview fill:#00D4FF,color:#000
    style ProductSettings fill:#00D4FF,color:#000

    style PromptInput fill:#8A2BE2,color:#FFF
    style CreativeAgent fill:#FF00FF,color:#FFF
    style GenerateImage fill:#39FF14,color:#000
    style PlaceAsset fill:#8A2BE2,color:#FFF

    style MerchSlice fill:#8A2BE2,color:#FFF
    style FabricObjects fill:#8A2BE2,color:#FFF

    style DraftProduct fill:#FF8C00,color:#000
    style PODConnector fill:#FF00FF,color:#FFF
    style PODServices fill:#FF8C00,color:#000

    style FS fill:#39FF14,color:#000
    style CS fill:#39FF14,color:#000
    style Stripe fill:#FF8C00,color:#000
```

## Transition Breakdown

1. **Template Selection:** User selects a merch template (T-shirt, hoodie, tote bag) from the **Template Library**. Fabric.js is initialized with the template's dimensions and layers.

2. **AI-Assisted Design:** User enters a design prompt (e.g., "neon geometric band logo"). The **CreativeAgent** interprets this intent and sends a refined prompt to **Gemini 3.1 Pro Image** for generation.

3. **Asset Placement:** The generated image is placed on the canvas as a **Fabric.js raster object**. User can position, resize, rotate, or layer it with other elements.

4. **Real-time Mockup:** The **Mockup Preview** renders the design on a photo-realistic product image (e.g., shirt on a model), updating live as the user edits.

5. **Design Persistence:** Edits to **Fabric.js objects** sync to the **Zustand `merch Store`**. The entire design state is serializable to JSON and saved to **Firestore** as a draft.

6. **Product Configuration:** User enters **Product Settings** (price per unit, available sizes/colors, SKU) via a side panel.

7. **POD Integration:** Once finalized, the **POD Connector** packages the design (SVG/high-res export) and metadata into the specific format required by the **Print-on-Demand Service** (Teespring, Printful, etc.).

8. **Live Store:** The product goes live in the service's inventory. When customers order, webhooks return order data to **Stripe** for revenue tracking and split calculation.

9. **Revenue Attribution:** **Firestore** records all transactions, attributing revenue correctly to the artist account and any collaborators.

