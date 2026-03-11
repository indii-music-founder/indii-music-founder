/**
 * BrowserAgentService — Gemini Computer Use Integration
 *
 * Core orchestrator for AI-driven browser automation using Google's
 * Gemini Computer Use API. Enables portal automation for services
 * that have no public APIs (ASCAP, BMI, SoundExchange, etc.).
 *
 * Architecture:
 *   1. Playwright controls a headless Chromium browser
 *   2. Screenshots are sent to Gemini Computer Use model
 *   3. Model returns UI actions (click, type, scroll, wait)
 *   4. Actions are executed by Playwright
 *   5. Loop until task complete or max steps reached
 *
 * Model: gemini-2.5-computer-use-preview-10-2025
 * SDK: @google/genai
 * Runtime: Electron main process (Node.js) via IPC
 */

import { AI_MODELS } from '@/core/config/ai-models';

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

// ─── Service ────────────────────────────────────────────────────

export class BrowserAgentService {
    private config: BrowserAgentConfig;
    private currentTask: AgentTask | null = null;
    private apiKey: string;
    private listeners: Map<string, Set<(step: AgentStep) => void>> = new Map();

    constructor(config: Partial<BrowserAgentConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.apiKey = import.meta.env.VITE_API_KEY || '';
    }

    /**
     * Check if the service is ready to run.
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0;
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
     */
    private async runAgentLoop(
        task: AgentTask,
        startUrl: string,
        credentials?: PortalCredentials
    ): Promise<AgentTask> {
        const startTime = Date.now();

        // Build the system prompt with credential context
        const systemPrompt = this.buildSystemPrompt(task.portal, task.goal, credentials);

        // Initial message to the model
        const messages: Array<{ role: string; content: string; screenshot?: string }> = [
            {
                role: 'user',
                content: `Navigate to ${startUrl} and complete this task: ${task.goal}`,
            },
        ];

        for (let step = 0; step < this.config.maxSteps; step++) {
            // Check timeout
            if (Date.now() - startTime > this.config.timeout) {
                task.status = 'failed';
                task.error = `Task timed out after ${this.config.timeout / 1000}s`;
                break;
            }

            // Take screenshot (placeholder — real impl uses Playwright page.screenshot())
            const screenshot = await this.captureScreenshot();

            // Send to Gemini Computer Use
            const action = await this.getNextAction(systemPrompt, messages, screenshot);

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

            // Execute the action (placeholder — real impl uses Playwright)
            await this.executeAction(action);

            agentStep.duration = Date.now() - stepStart;
            agentStep.screenshotAfter = await this.captureScreenshot();
            task.steps.push(agentStep);
            this.emit('step', agentStep);

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
- Always prefer "Save as Draft" over "Submit" when available`;
    }

    /**
     * Send screenshot to Gemini Computer Use and get next action.
     *
     * Uses the computer_use tool in the Gemini API.
     */
    private async getNextAction(
        _systemPrompt: string,
        _messages: Array<{ role: string; content: string; screenshot?: string }>,
        _screenshot: string
    ): Promise<BrowserAction> {
        // In production, this calls the Gemini API with computer_use tool:
        //
        // const genAI = new GoogleGenAI({ apiKey: this.apiKey });
        // const response = await genAI.models.generateContent({
        //     model: COMPUTER_USE_MODEL,
        //     contents: [
        //         { role: 'user', parts: [
        //             { text: systemPrompt },
        //             { inlineData: { mimeType: 'image/png', data: screenshot } }
        //         ]}
        //     ],
        //     tools: [{ computerUse: { environment: { width: 1280, height: 800 } } }],
        //     config: { temperature: 1.0 }
        // });
        //
        // The response contains function_call with action type + coordinates/text.
        // Parse and return as BrowserAction.

        console.debug(`[BrowserAgent] Model: ${COMPUTER_USE_MODEL}`);
        console.debug(`[BrowserAgent] Would send screenshot and get next action`);

        // Placeholder: return done (real impl parses model response)
        return { type: 'done', result: 'Task execution requires Electron main process with Playwright' };
    }

    /**
     * Execute a browser action.
     * In production, this uses Playwright's page object.
     */
    private async executeAction(action: BrowserAction): Promise<void> {
        switch (action.type) {
            case 'click':
                console.debug(`[BrowserAgent] Click at (${action.x}, ${action.y})`);
                // page.mouse.click(action.x, action.y)
                break;
            case 'type':
                console.debug(`[BrowserAgent] Type: "${action.text.substring(0, 20)}..."`);
                // page.keyboard.type(action.text)
                break;
            case 'scroll':
                console.debug(`[BrowserAgent] Scroll ${action.direction} at (${action.x}, ${action.y})`);
                // page.mouse.wheel(0, action.direction === 'down' ? 100 : -100)
                break;
            case 'keypress':
                console.debug(`[BrowserAgent] Keypress: ${action.key}`);
                // page.keyboard.press(action.key)
                break;
            case 'navigate':
                console.debug(`[BrowserAgent] Navigate to: ${action.url}`);
                // page.goto(action.url)
                break;
            case 'wait':
                console.debug(`[BrowserAgent] Wait ${action.milliseconds}ms`);
                await this.sleep(action.milliseconds);
                break;
            default:
                break;
        }
    }

    /**
     * Capture a screenshot of the current browser state.
     * Returns base64-encoded PNG.
     */
    private async captureScreenshot(): Promise<string> {
        // In production: const buffer = await page.screenshot({ type: 'png' });
        // return buffer.toString('base64');
        return '';
    }

    /**
     * Determine if an action is high-risk and needs user confirmation.
     */
    private isHighRiskAction(action: BrowserAction): boolean {
        if (action.type === 'click') {
            // Would check the screenshot context for dangerous buttons
            return false;
        }
        if (action.type === 'type') {
            // Check if typing in a payment field
            return false;
        }
        return false;
    }

    /**
     * Execute the task via Electron IPC (production path).
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
