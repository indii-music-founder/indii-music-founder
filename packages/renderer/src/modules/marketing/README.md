# Marketing & Campaigns Module (RC1)

The Marketing module is the growth engine of indiiOS. It automates the complex task of promoting creative work, ensuring that every release reaches its maximum potential through AI-driven asset creation and campaign strategy.

## 🚀 Key Features
- **Campaign Architect:** Plan multi-week release cycles including teaser phases, launch day, and post-release support.
- **AI Copywriter:** Generates platform-specific captions, bios, and press releases that maintain brand voice.
- **Brand Kit Management:** Centralized storage for logos, color palettes, and fonts to ensure visual consistency across all assets.
- **Asset Optimizer:** Automatically resizes and formats creative assets for TikTok, Instagram, YouTube, and X.
- **EPK Builder:** Generate professional Electronic Press Kits from release metadata and creative studio assets.

## 🏗️ Technical Architecture
- **`MarketingDashboard`**: Central hub for campaign status and asset management.
- **`MarketingAgent`**: Specialist agent for strategy development and copywriting.
- **Campaign Schemas**: Strict Zod-based definitions for campaign phases and milestones.
- **Context Awareness:** Automatically pulls project details from the **Publishing** module to ensure accuracy.

## 🔗 Integrations
- **Social Module:** Direct deployment of marketing assets to audience platforms.
- **Creative Studio:** One-click import of posters and promotional graphics.
- **Finance:** Tracks marketing spend and calculates campaign ROI.
