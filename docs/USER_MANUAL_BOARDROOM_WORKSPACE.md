# User Manual: Boardroom Multi-View Workspace & Embedded Browser

**Version:** 2.4.0  
**Last Updated:** November 2026  
**Module:** Executive Boardroom HQ (`/boardroom`)  
**Supported Platforms:** Electron Studio Desktop (macOS/Windows/Linux), Web Browser (PWA/Next.js)

---

## 1. Executive Overview

The **Boardroom Multi-View Workspace** transforms the Executive Boardroom from a conversational interface into an interactive command hub. Rather than switching between browser windows, external music portals, and internal studio tools, founders and artists can run live research, audit DSP releases, inspect generated legal and media assets, and view agent telemetry directly within the Boardroom.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [← Back to Studio]   BOARDROOM HQ   [Browser] [Studio] [Workbench] [Feed]        │
├─────────────────────┬────────────────────────────────────┬───────────────────────┤
│                     │                                    │                       │
│   ORBITAL TABLE     │         BOARDROOM WORKSPACE        │     SWARM CHAT        │
│                     │                                    │                       │
│  23 Specialists     │  • Live Browser (DSPs / PROs)      │  Executive Conductor  │
│  & Department Pills │  • Studio Module In-Place Preview  │  & Seated Specialists │
│  (Active Agents)    │  • Asset / Legal Workbench         │                       │
│                     │  • Live Agent Execution Feed       │                       │
│                     │                                    │                       │
│     (28% Width)     │            (40% Width)             │      (32% Width)      │
└─────────────────────┴────────────────────────────────────┴───────────────────────┘
```

---

## 2. Opening & Navigating the Workspace

The Boardroom Workspace is designed to stay out of the way when you only want an executive conversation, but immediately available when evidence, portal access, or asset inspection is needed.

### 2.1 Launching the Workspace

You can open the workspace through two primary methods:

1. **Header Dock Pills:**
   In the top-right header of Boardroom HQ, click any of the 4 tool pills:
   - **`Browser`** (Globe icon): Opens the live web navigation pane.
   - **`Studio`** (Layout icon): Opens in-place preview of any Studio department module.
   - **`Workbench`** (Layers icon): Opens the asset, document, and legal split sheet inspector.
   - **`Feed`** (Radio icon): Opens real-time autonomous agent task telemetry.

2. **In-Chat Link Interception:**
   Whenever an agent in the Boardroom discussion shares a link (e.g., Spotify for Artists, ASCAP portal, BMI catalog, MLC mechanical database, or an external reference), clicking that link intercepts standard browser navigation and opens it directly inside the Boardroom Workspace split pane.

### 2.2 Layout Modes

The Boardroom Workspace supports three layout states:

- **Closed Mode:** Standard Boardroom view. The circular orbital table takes the left half (55%), and the executive chat takes the right half (45%).
- **Split Mode (Default Active):** A 3-column split view:
  - **Left (28%):** Orbital table and seated agent status.
  - **Center (40%):** Active Boardroom Workspace view.
  - **Right (32%):** Persistent executive discussion stream.
- **Stage Mode (Full Canvas):** Maximize the workspace across the left and center panes (68% width) while keeping the executive chat stream docked on the right. Ideal for reading dense split sheets, editing canvas designs, or viewing complex analytics dashboards. Toggle this via the **Stage / Split** button in the workspace header.

---

## 3. The 4 Workspace Views

### 3.1 Live Browser (`browser`)

The live browser gives you embedded web access without losing context with your executive agents.

- **Navigation Controls:** Back, Forward, Reload, and a secure address bar with HTTPS validation.
- **Quick Bookmarks Bar:** One-click shortcuts to key music industry portals:
  - **Spotify for Artists** (`https://artists.spotify.com`) — DSP verification & analytics.
  - **Apple Music for Artists** (`https://artists.apple.com`) — DSP verification.
  - **ASCAP Member Access** (`https://members.ascap.com`) — Performing rights registration & writer share lookup.
  - **BMI Online Services** (`https://online.bmi.com`) — PRO catalog confirmation.
  - **The MLC Portal** (`https://portal.themlc.com`) — US mechanical royalty search & claim verification.
  - **SoundExchange Portal** (`https://sportal.soundexchange.com`) — Neighboring rights and master performance royalties.
  - **US Copyright Office (eCO)** (`https://eco.copyright.gov`) — PA / SR copyright filings.
  - **Instagram / Social** (`https://www.instagram.com`) — Campaign and social drops preview.
- **Add Custom Bookmark:** Type any URL and click the **+ Bookmark** button to pin it to your quick-access bar.
- **External Popout:** Click **Open in New Window** (`ExternalLink` icon) at any time to open the current page in your default desktop browser.

### 3.2 Studio Module In-Place Preview (`module`)

Preview and interact with other indii Studio departments without navigating away from the Boardroom:
- Select any department from the module selector:
  - **Creative:** Moodboards, cover art generation, and prompt builder.
  - **Music Operations:** Release pipeline, track stems, and metadata.
  - **Video Studio:** Video cuts, Remotion compositions, and teaser renders.
  - **Distribution:** DDEX delivery packages and DSP submission checklists.
  - **Publishing & PRO:** Work registration manifests and royalty shares.
  - **Finance:** Revenue projections, expense audits, and cashflow modeling.
  - **Legal:** Contract templates, clearance status, and split sheets.
  - **Marketing:** Campaign calendars, social drops, and audience heatmaps.
- Includes an **"Open Full Module"** button to jump directly to the standalone studio view when needed.

### 3.3 Asset & Legal Workbench (`workbench`)

A dedicated inspection station for documents and media created during boardroom sessions:
- **Legal Split Sheets:** Review writer, publisher, and master splits with automated validation checking that shares total exactly 100%.
- **High-Resolution Media Inspector:** Zoom, inspect, and verify cover art, video frames, and promotional banners.
- **A2UI Interactive Cards:** Render structured deliverables (e.g., campaign budgets, release dates, tracklists) generated by specialist agents.
- **One-Click Delivery:** Export directly to your Studio project or send to storage.

### 3.4 Agent Live Telemetry Feed (`agent-feed`)

Real-time visibility into the autonomous background processes executed by the agent swarm:
- **Active Workflow Steps:** View DAG (Directed Acyclic Graph) node execution status in real time (`QUEUED`, `RUNNING`, `STEP_COMPLETE`, `FAILED`).
- **Telemetry Counters:** Live metrics for total execution steps, pending actions, and active tasks.
- **Rights Copilot Feed:** Live monitoring of external rights queries and scraping tasks.
- **Emergency Halt:** A red **"Halt Execution"** button allows you to instantly pause autonomous operations if a conflicting strategy is detected.

---

## 4. Platform Differences: Native Desktop vs. Web

| Feature | Desktop App (Electron Studio) | Web Browser (Next.js / PWA) |
| :--- | :--- | :--- |
| **Technology** | Native `WebContentsView` attached to main window | Sandboxed HTML `<iframe>` |
| **CSP / `X-Frame-Options`** | **Bypassed natively.** Can load any portal (Spotify, ASCAP, BMI, Google). | **Enforced by target sites.** Some portals block embedding. |
| **Session Isolation** | Isolated partition: `persist:boardroom-browser` (cookies and sessions persist safely). | Standard browser sandbox restrictions. |
| **SSRF Protection** | Verified by main-process `validateSafeUrlAsync` (blocks localhost/private networks). | Browser origin policy. |
| **Fallback Modes** | Native web rendering. | Automatic fallback to **Reader Mode** (text extraction) or "Open in New Tab". |

> [!NOTE]
> For the best experience with portals that forbid embedding (such as Spotify for Artists or ASCAP), use the **indii Desktop App** (`Port 4242`), which natively bypasses `X-Frame-Options` restrictions using Electron's secure `WebContentsView` architecture.

---

## 5. TypeSafe Jev System One Intelligence

The Boardroom Workspace is natively integrated with **TypeSafe Jev System One** models, providing autonomous semantic classification:

1. **Automatic Page Categorization:**
   As you browse, Jev analyzes the active URL and page title to automatically categorize the page into one of 7 music industry domains:
   - `dsp`: Streaming platforms (Spotify, Apple Music, Tidal, Amazon Music).
   - `pro_rights`: Performance & mechanical rights (ASCAP, BMI, SESAC, MLC, SoundExchange).
   - `legal_compliance`: Legal entities, copyright offices, and contract platforms.
   - `marketing_social`: Social networks and promotional channels.
   - `press_pr`: Music publications, blogs, and press releases.
   - `distribution`: Distributors (DistroKid, TuneCore, CD Baby, Symphonic).
   - `general_research`: General web research and documentation.

2. **Department Ownership & Relevance Scoring:**
   Jev tags each page with its primary studio department owner (e.g. `music_operations`, `legal`, `marketing`) and a 0.0–1.0 relevance score, displaying a subtle classification badge in the browser toolbar:
   ```
   [ PRO / Rights  •  Relevance: 98%  •  Owner: Legal & Business Affairs ]
   ```

3. **Autonomous Workspace Recommendations:**
   Jev continually analyzes the recent conversation between you and the agents. If the swarm discusses marketing campaigns, Jev displays a recommendation pill:
   ```
   💡 Suggestion: Open Marketing Campaign Calendar [Open View]
   ```
   Clicking the suggestion immediately switches the workspace to the recommended tool.

---

## 6. Keyboard Shortcuts & Quick Actions

- `Esc`: Close the active Boardroom Workspace pane (returns to standard 2-panel view).
- `Cmd/Ctrl + [`: Back in embedded browser history.
- `Cmd/Ctrl + ]`: Forward in embedded browser history.
- `Cmd/Ctrl + R`: Reload the active embedded webpage.
- **Stage Button** (top right of workspace): Toggle between 3-way Split View and full-width Stage View.
