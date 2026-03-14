# Merch Module 5000-Action Stress Test — Specification

This file documents the full scope of the browser-based stress test.
See the browser subagent recording for the live execution.

## Total Target: ~5000 actions

### Phase 1 — Dashboard Core (Actions 1-500)
- Navigate to /merch
- Click all 5 center tabs (Dashboard, Inventory, Pricing, POD Partners, Web3) × 20 cycles
- Read and verify all 3 stats cards (Revenue, Units Sold, Conversion Rate)
- Click "New Design" button multiple times
- Click "Preview Store" and interact with storefront modal (copy link, deploy)
- Click "Create Drop" and run through wizard 10 times
- Click "View All" on top products
- Interact with left panel widgets (Store Stats, Top Sellers, New Designs)
- Interact with right panel widgets (Templates, POD Partners, Funnel, Campaign Ready)

### Phase 2 — Web3 Tab Deep Dive (Actions 501-1200)
- Wallet sub-tab: click MetaMask + WalletConnect buttons
- Smart Contracts: Toggle ERC-721 / ERC-1155, fill token name, symbol, ISRC
- Add payees up to 6, remove payees, edit percentages, roles, wallet addresses
- Deploy contract multiple times
- Blockchain Ledger: search ISRC, click "Sync to IPFS", copy hashes
- Token Gated: add 20+ tracks, select each, toggle publish/unpublish
- Simulate wallet toggle, play/pause in fan preview
- Delete tracks, copy slugs

### Phase 3 — Inventory & Pricing (Actions 1201-1800)
- Inventory tab: click sync button, verify empty state
- Pricing tab: click "Apply" on each product suggestion
- Tab-cycle between all center tabs rapidly 50 times

### Phase 4 — POD Partners (Actions 1801-2200)
- Click connect on Printful, Printify, Gooten
- Fill API key in modal dialogs
- Toggle show/hide key
- Cancel and re-open modals
- Click sync buttons on connected partners

### Phase 5 — Drop Campaign Wizard Deep (Actions 2201-2800)
- Open wizard 20 times
- Step 1: select/deselect products rapidly
- Step 2: type drop name, set date, set time
- Step 3: toggle pre-sale, superfan, edit teaser message
- Navigate back and forth between steps
- Launch drops
- Close and reopen

### Phase 6 — Storefront Preview (Actions 2801-3200)
- Open storefront modal 20 times
- Copy link each time
- Click Deploy via Stripe
- Close and reopen rapidly

### Phase 7 — Designer (Actions 3201-4200)
- Navigate to /merch/design
- Click all tool buttons: Templates, Text, Shape, AI Gen
- Add 50+ text elements
- Add 50+ shapes (stars)
- Click undo/redo 100 times
- Click all 6 alignment buttons
- Click all 6 background colors
- Toggle work mode (Agent/User) 20 times
- Edit design name
- Save draft
- Click Help (keyboard shortcuts)
- Click History
- Click Showroom transition multiple times

### Phase 8 — Showroom Product Types (Actions 4201-5000)
- Select every product type (20 types): T-Shirt, Hoodie, Cap, Beanie, Bandana, Vinyl, CD, Cassette, Tote, Stickers, Patch, Pin, Keychain, Poster, Flag, Mug, Bottle, Phone Case
- For each type, click every placement option
- Click scene presets (8 presets × multiple)
- Type scene descriptions
- Mobile section toggles (Setup, Stage, Production)
