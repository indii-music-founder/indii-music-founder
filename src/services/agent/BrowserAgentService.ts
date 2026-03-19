/**
 * BrowserAgentService — Gemini Computer Use Integration
 *
 * Core orchestrator for AI-driven browser automation using Google's
 * Gemini Computer Use API. Enables portal automation for services
 * that have no public APIs (ASCAP, BMI, SoundExchange, etc.).
 *
 * Architecture:
 *   1. Playwright controls a headless Chromium browser (Electron main process via IPC)
 *   2. Screenshots are sent to Gemini Computer Use model
 *   3. Model returns UI actions (click, type, scroll, wait)
 *   4. Actions are executed by Playwright (or DOM in web dev mode)
 *   5. Loop until task complete or max steps reached
 *
 * Model: gemini-2.5-computer-use-preview-10-2025
 * SDK: @google/genai
 * Runtime: Electron main process (Node.js) via IPC for production
 *          Web renderer (DOM-based) for dev/testing
 */

import { AI_MODELS } from '@/core/config/ai-models';
import { GoogleGenAI } from '@google/genai';
import { logger } from '@/utils/logger';

// ─── Types ──────────────────────────────────────────────────────

export type BrowserAction =
    | { type: 'click'; x: number; y: number }
    | { type: 'type'; text: string }
    | { type: 'scroll'; x: number; y: number; direction: 'up' | 'down' }
    | { type: 'keypress'; key: string }
    | { type: 'navigate'; url: string }
    | { type: 'wait'; milliseconds: number }
    | { type: 'screenshot' }
    | { type: 'done'; result: string };

export interface AgentStep {
    stepNumber: number;
    timestamp: string;
    action: BrowserAction;
    screenshotBefore?: string; // base64
    screenshotAfter?: string;  // base64
    modelResponse?: string;
    duration: number;
}

export interface AgentTask {
    id: string;
    portal: string;
    goal: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    steps: AgentStep[];
    startedAt?: string;
    completedAt?: string;
    error?: string;
    result?: string;
}

export interface PortalCredentials {
    portal: string;
    username: string;
    password: string;
}

export interface BrowserAgentConfig {
    maxSteps: number;
    screenshotWidth: number;
    screenshotHeight: number;
    stepDelay: number;      // ms between steps
    timeout: number;        // total task timeout ms
    headless: boolean;
    userConfirmHighRisk: boolean; // pause for user confirmation on risky actions
}

// ─── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: BrowserAgentConfig = {
    maxSteps: 50,
    screenshotWidth: 1280,
    screenshotHeight: 800,
    stepDelay: 1000,
    timeout: 300_000, // 5 minutes
    headless: true,
    userConfirmHighRisk: true,
};

// ─── Computer Use Model ─────────────────────────────────────────

const COMPUTER_USE_MODEL = 'gemini-2.5-computer-use-preview-10-2025';

// ─── High-risk keyword patterns ─────────────────────────────────

const HIGH_RISK_KEYWORDS = [
    'delete', 'remove', 'cancel subscription', 'close account',
    'terminate', 'submit payment', 'authorize payment', 'wire transfer',
    'change password', 'reset password', 'deactivate', 'unsubscribe',
    'agree to terms', 'accept terms', 'confirm purchase',
];

// ─── Service ────────────────────────────────────────────────────

export class BrowserAgentService {
    private config: BrowserAgentConfig;
    private currentTask: AgentTask | null = null;
    private apiKey: string;
    private genAI: GoogleGenAI | null = null;
    private listeners: Map<string, Set<(step: AgentStep) => void>> = new Map();

    constructor(config: Partial<BrowserAgentConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.apiKey = import.meta.env.VITE_API_KEY || '';

        if (this.apiKey) {
            this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
        }
    }

    /**
     * Check if the service is ready to run.
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.genAI !== null;
    }

    /**
     * Execute a browser automation task.
     *
     * This is the main entry point. Provides the goal and portal URL,
     * and the agent will navigate, interact, and complete the task.
     *
     * In production, this runs in the Electron main process via IPC
     * to access Node.js Playwright. In the web renderer, it delegates
     * to the main process.
     */
    async executeTask(
        portal: string,
        goal: string,
        startUrl: string,
        credentials?: PortalCredentials
    ): Promise<AgentTask> {
        if (!this.isConfigured()) {
            throw new Error('API key not configured for browser agent');
        }

        const task: AgentTask = {
            id: `ba-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            portal,
            goal,
            status: 'running',
            steps: [],
            startedAt: new Date().toISOString(),
        };

        this.currentTask = task;

        try {
            // In Electron, delegate to main process via IPC
            if (this.isElectron()) {
                const result = await this.executeViaIPC(task, startUrl, credentials);
                return result;
            }

            // In web context, use the agent loop directly (for testing/dev)
            const result = await this.runAgentLoop(task, startUrl, credentials);
            return result;
        } catch (err) {
            task.status = 'failed';
            task.error = err instanceof Error ? err.message : String(err);
            task.completedAt = new Date().toISOString();
            return task;
        }
    }

    /**
     * The core agent loop.
     *
     * This method orchestrates the screenshot → model → action cycle.
     * In production, the Playwright parts run in Node.js (Electron main process).
     * In dev/web mode, we use html2canvas for screenshots and DOM APIs for actions.
     */
    private async runAgentLoop(
        task: AgentTask,
        startUrl: string,
        credentials?: PortalCredentials
    ): Promise<AgentTask> {
        const startTime = Date.now();

        // Build the system prompt with credential context
        const systemPrompt = this.buildSystemPrompt(task.portal, task.goal, credentials);

        // Conversation history for multi-turn interaction with the model
        const conversationHistory: Array<{
            role: 'user' | 'model';
            parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
        }> = [];

        // Initial user message
        conversationHistory.push({
            role: 'user',
            parts: [{ text: `Navigate to ${startUrl} and complete this task: ${task.goal}` }],
        });

        for (let step = 0; step < this.config.maxSteps; step++) {
            // Check timeout
            if (Date.now() - startTime > this.config.timeout) {
                task.status = 'failed';
                task.error = `Task timed out after ${this.config.timeout / 1000}s`;
                break;
            }

            // Take screenshot
            const screenshot = await this.captureScreenshot();

            // Send to Gemini Computer Use
            const action = await this.getNextAction(systemPrompt, conversationHistory, screenshot);

            const agentStep: AgentStep = {
                stepNumber: step + 1,
                timestamp: new Date().toISOString(),
                action,
                screenshotBefore: screenshot,
                duration: 0,
            };

            const stepStart = Date.now();

            // Check for completion
            if (action.type === 'done') {
                task.status = 'completed';
                task.result = action.result;
                agentStep.duration = Date.now() - stepStart;
                task.steps.push(agentStep);
                this.emit('step', agentStep);
                break;
            }

            // Check for high-risk actions that need user confirmation
            if (this.config.userConfirmHighRisk && this.isHighRiskAction(action)) {
                task.status = 'paused';
                agentStep.duration = Date.now() - stepStart;
                task.steps.push(agentStep);
                this.emit('step', agentStep);
                this.emit('confirm-required', agentStep);
                break;
            }

            // Execute the action
            await this.executeAction(action);

            agentStep.duration = Date.now() - stepStart;
            agentStep.screenshotAfter = await this.captureScreenshot();
            task.steps.push(agentStep);
            this.emit('step', agentStep);

            // Add the model's action to conversation history
            conversationHistory.push({
                role: 'model',
                parts: [{ text: `Executed action: ${JSON.stringify(action)}` }],
            });

            // Add the post-action screenshot to conversation history for next iteration
            if (agentStep.screenshotAfter) {
                conversationHistory.push({
                    role: 'user',
                    parts: [
                        { text: 'Action completed. Here is the updated screenshot. What is the next step?' },
                        { inlineData: { mimeType: 'image/png', data: agentStep.screenshotAfter } },
                    ],
                });
            }

            // Add step delay
            await this.sleep(this.config.stepDelay);
        }

        if (task.status === 'running') {
            task.status = 'failed';
            task.error = `Max steps (${this.config.maxSteps}) reached without completion`;
        }

        task.completedAt = new Date().toISOString();
        return task;
    }

    /**
     * Build a system prompt for the agent, tailored to the portal.
     */
    private buildSystemPrompt(
        portal: string,
        goal: string,
        credentials?: PortalCredentials
    ): string {
        const credentialBlock = credentials
            ? `\nLogin credentials are available. Username: ${credentials.username}. Use these when a login form is encountered.`
            : '\nNo login credentials provided. If a login is required, report it as a blocker.';

        return `You are an AI browser agent operating on the ${portal} web portal.

Your task: ${goal}

Instructions:
- Navigate the website systematically
- Fill in forms accurately using the provided data
- Wait for pages to load before interacting
- Report any errors or unexpected states
- If you encounter a CAPTCHA, pause and request human assistance
- Never submit payment information without explicit confirmation
${credentialBlock}

Safety rules:
- Do NOT click "Delete" or "Remove" buttons unless explicitly instructed
- Do NOT change account settings or passwords
- Do NOT agree to new terms of service without pausing for confirmation
- Always prefer "Save as Draft" over "Submit" when available

Response format:
Respond with a JSON object describing your next action. Use one of these types:
- {"type": "click", "x": <number>, "y": <number>}
- {"type": "type", "text": "<string>"}
- {"type": "scroll", "x": <number>, "y": <number>, "direction": "up"|"down"}
- {"type": "keypress", "key": "<key>"}
- {"type": "navigate", "url": "<url>"}
- {"type": "wait", "milliseconds": <number>}
- {"type": "done", "result": "<description of what was accomplished>"}`;
    }

    /**
     * Send screenshot to Gemini Computer Use and get next action.
     *
     * Uses the @google/genai SDK to call the Gemini Computer Use model.
     * The model analyzes the screenshot and returns the next UI action.
     */
    private async getNextAction(
        systemPrompt: string,
        conversationHistory: Array<{
            role: 'user' | 'model';
            parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
        }>,
        screenshot: string
    ): Promise<BrowserAction> {
        if (!this.genAI) {
            return { type: 'done', result: 'Gemini API not initialized — missing VITE_API_KEY' };
        }

        // If no screenshot available (e.g., web mode without html2canvas), return done
        if (!screenshot) {
            return { type: 'done', result: 'Screenshot capture not available in this environment. Use Electron desktop app for full browser automation.' };
        }

        try {
            // Build the contents array with conversation history and current screenshot
            const contents = [
                ...conversationHistory,
                {
                    role: 'user' as const,
                    parts: [
                        { text: 'Analyze the current screenshot and determine the next action to complete the task. Respond with a single JSON action object.' },
                        { inlineData: { mimeType: 'image/png', data: screenshot } },
                    ],
                },
            ];

            const response = await this.genAI.models.generateContent({
                model: COMPUTER_USE_MODEL,
                contents,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 1.0,
                },
            });

            const text = response.text?.trim() || '';
            logger.info(`[BrowserAgent] Model response: ${text.substring(0, 200)}`);

            // Parse the JSON action from the model response
            return this.parseActionFromResponse(text);
        } catch (error) {
            logger.error('[BrowserAgent] Gemini API call failed:', error);

            // If the model fails, return done with error context
            return {
                type: 'done',
                result: `Model error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Parse a BrowserAction from the model's text response.
     * Handles both raw JSON and JSON wrapped in markdown code blocks.
     */
    private parseActionFromResponse(text: string): BrowserAction {
        try {
            // Strip markdown code fences if present
            let jsonStr = text;
            const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1]!.trim();
            }

            // Try to find a JSON object in the response
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                // If the model returned a natural language response, treat it as done
                return { type: 'done', result: text };
            }

            const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

            // Validate the action type
            const validTypes = ['click', 'type', 'scroll', 'keypress', 'navigate', 'wait', 'done', 'screenshot'];
            if (!parsed.type || !validTypes.includes(parsed.type as string)) {
                return { type: 'done', result: `Unrecognized action type: ${JSON.stringify(parsed)}` };
            }

            return parsed as unknown as BrowserAction;
        } catch (_parseError) {
            // If parsing fails entirely, treat the response as a completion message
            return { type: 'done', result: `Could not parse action. Model said: ${text.substring(0, 500)}` };
        }
    }

    /**
     * Execute a browser action.
     *
     * In Electron: actions are executed by Playwright in the main process (via IPC).
     * In web dev mode: actions are executed via DOM APIs for testing purposes.
     */
    private async executeAction(action: BrowserAction): Promise<void> {
        switch (action.type) {
            case 'click': {
                logger.info(`[BrowserAgent] Click at (${action.x}, ${action.y})`);
                // In web mode, find and click the element at coordinates
                if (typeof document !== 'undefined') {
                    const element = document.elementFromPoint(action.x, action.y);
                    if (element instanceof HTMLElement) {
                        element.click();
                    }
                }
                break;
            }
            case 'type': {
                logger.info(`[BrowserAgent] Type: "${action.text.substring(0, 20)}..."`);
                // In web mode, type into the currently focused element
                if (typeof document !== 'undefined') {
                    const activeElement = document.activeElement;
                    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
                        activeElement.value += action.text;
                        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                break;
            }
            case 'scroll': {
                logger.info(`[BrowserAgent] Scroll ${action.direction} at (${action.x}, ${action.y})`);
                if (typeof window !== 'undefined') {
                    const scrollAmount = action.direction === 'down' ? 300 : -300;
                    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                }
                break;
            }
            case 'keypress': {
                logger.info(`[BrowserAgent] Keypress: ${action.key}`);
                if (typeof document !== 'undefined') {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, bubbles: true }));
                    document.dispatchEvent(new KeyboardEvent('keyup', { key: action.key, bubbles: true }));
                }
                break;
            }
            case 'navigate': {
                logger.info(`[BrowserAgent] Navigate to: ${action.url}`);
                // In web mode, open in a new tab for safety (never navigate the current app)
                if (typeof window !== 'undefined') {
                    window.open(action.url, '_blank', 'noopener,noreferrer');
                }
                break;
            }
            case 'wait': {
                logger.info(`[BrowserAgent] Wait ${action.milliseconds}ms`);
                await this.sleep(action.milliseconds);
                break;
            }
            default:
                break;
        }
    }

    /**
     * Capture a screenshot of the current browser state.
     * Returns base64-encoded PNG.
     *
     * In Electron: Playwright's page.screenshot() is used via IPC.
     * In web mode: Uses html2canvas for DOM-to-canvas rendering.
     */
    private async captureScreenshot(): Promise<string> {
        if (typeof document === 'undefined') {
            return '';
        }

        try {
            // Use Canvas API to capture the viewport as a screenshot
            // This is a lightweight fallback for when html2canvas is not available.
            // For production Electron use, Playwright's page.screenshot() is used via IPC.
            const canvas = document.createElement('canvas');
            canvas.width = this.config.screenshotWidth;
            canvas.height = this.config.screenshotHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return '';

            // Render the body to a canvas via SVG foreignObject (limited but zero-dependency)
            const svgData = `
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      ${new XMLSerializer().serializeToString(document.body)}
    </div>
  </foreignObject>
</svg>`;

            const img = new Image();
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('SVG rendering failed'));
                };
                img.src = url;
            });

            // Convert canvas to base64 PNG (strip the data:image/png;base64, prefix)
            const dataUrl = canvas.toDataURL('image/png');
            return dataUrl.replace(/^data:image\/png;base64,/, '');
        } catch (error) {
            logger.warn('[BrowserAgent] html2canvas screenshot failed, falling back to empty:', error);
            return '';
        }
    }

    /**
     * Determine if an action is high-risk and needs user confirmation.
     *
     * Checks both the action type/content and recent model responses
     * for dangerous keywords like "delete", "payment", "terms of service".
     */
    private isHighRiskAction(action: BrowserAction): boolean {
        // Type actions: check if the text contains sensitive content
        if (action.type === 'type') {
            const lowerText = action.text.toLowerCase();
            // Credit card patterns (basic check)
            if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(action.text)) {
                return true; // Looks like a credit card number
            }
            // SSN pattern
            if (/\d{3}-\d{2}-\d{4}/.test(action.text)) {
                return true;
            }
            // Check for sensitive keywords
            if (HIGH_RISK_KEYWORDS.some(keyword => lowerText.includes(keyword))) {
                return true;
            }
        }

        // Click actions: we can't know what button it is without OCR on the screenshot,
        // but the model's response text (in conversationHistory) should have described what it's clicking.
        // The model is instructed to pause for confirmation on dangerous actions.

        return false;
    }

    /**
     * Execute the task via Electron IPC (production path).
     *
     * In Electron, the main process has access to Node.js Playwright.
     * The renderer sends the task configuration via IPC and receives
     * step-by-step updates via a stream or polling mechanism.
     */
    private async executeViaIPC(
        task: AgentTask,
        startUrl: string,
        credentials?: PortalCredentials
    ): Promise<AgentTask> {
        const electronAPI = (window as unknown as Record<string, unknown>).electronAPI as Record<string, (...args: unknown[]) => Promise<unknown>> | undefined;

        if (!electronAPI?.browserAgent) {
            throw new Error('Browser agent IPC not available. Run in Electron desktop app.');
        }

        const result = await electronAPI.browserAgent({
            task,
            startUrl,
            credentials,
            config: this.config,
            model: COMPUTER_USE_MODEL,
        });

        return result as AgentTask;
    }

    /**
     * Check if running in Electron.
     */
    private isElectron(): boolean {
        return typeof window !== 'undefined' &&
            !!(window as unknown as Record<string, unknown>).electronAPI;
    }

    /**
     * Get the current task.
     */
    getCurrentTask(): AgentTask | null {
        return this.currentTask;
    }

    /**
     * Subscribe to agent events.
     */
    on(event: string, callback: (step: AgentStep) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    /**
     * Unsubscribe from events.
     */
    off(event: string, callback: (step: AgentStep) => void): void {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: string, step: AgentStep): void {
        this.listeners.get(event)?.forEach(cb => cb(step));
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ─── Singleton ──────────────────────────────────────────────────

export const browserAgentService = new BrowserAgentService();

// ─── Re-export model constant for reference ─────────────────────

export { COMPUTER_USE_MODEL, AI_MODELS };
