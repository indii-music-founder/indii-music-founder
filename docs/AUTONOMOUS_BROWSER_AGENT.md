# Autonomous Browser Agent (Gemini Drive)

**Status:** Prototype / Beta
**Model:** `gemini-2.5-pro-ui-checkpoint`
**Core Library:** Puppeteer (Main Process)

## Overview

The Autonomous Browser Agent is a "self-driving" browser system integrated into indiiOS. Unlike traditional scrapers that rely on fixed selectors, this agent uses visual reasoning to navigate, interact with, and extract data from any website.

## Architecture

The system follows a **Brain-Body-Bridge** pattern:

### 1. The Brain (`BrowserAgentDriver.ts`)

- **Location**: Renderer Process (`src/services/agent/BrowserAgentDriver.ts`)
- **Role**: Orchestrator. It implements the autonomous loop:
    1. **Capture**: Requests a screenshot and the current URL via IPC.
    2. **Reason**: Sends the visual state to Gemini 2.5 Pro UI with a high-level goal.
    3. **Action**: Receives a JSON action (click, type, finish) and sends it to the Main process.
    4. **Repeat**: Continues until the model signals success or failure.

### 2. The Body (`BrowserAgentService.ts`)

- **Location**: Main Process (`electron/services/BrowserAgentService.ts`)
- **Role**: Executor. It uses Puppeteer to perform the actual browser actions:
  - `navigate(url)`
  - `click(selector)`
  - `typeInto(selector, text)`
  - `captureSnapshot()` (Screenshot + Text)
  - `performAction(action, selector, text)` (High-level wrapper for AI commands)

### 3. The Bridge (Electron IPC)

- **Location**: `electron/preload.ts` and `electron/main.ts`
- **Channels**:
  - `agent:perform-action`: Executes a single UI interaction.
  - `agent:capture-state`: Triggers a snapshot without re-navigating.
  - `agent:navigate-and-extract`: High-level script for simple tasks.

## Integration: Gemini Drive

The "Gemini Drive" concept refers to the model's ability to actuate the browser purely through visual feedback.

- **Input Prompt**: Includes the current screenshot as a base64 image and the goal string.
- **Model Output**: A structured JSON object:

```json
{
  "thought": "I need to click the search bar to find venues.",
  "action": "click",
  "params": { "selector": "input[name='q']" }
}
```

## Use Cases

1. **Venue Scouting**: Finding real-world venues, capacities, and contact info in real-time.
2. **License Scanning**: Navigating complex portals to extract sample clearance terms.
3. **Market Research**: Surfacing trends from social media or industry blogs.

## Development & Testing

You can manually test the driver using the **Browser Agent** tab in the Agent Dashboard.

- **URL**: Starting point (e.g., google.com)
- **Goal**: Clear instruction (e.g., "Find the pricing for DistroKid and return the annual cost")
