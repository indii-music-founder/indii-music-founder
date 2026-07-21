import { AutonomousIntelligence as AI, getResponseText } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { logger } from '@/utils/logger';

/**
 * ComputerAgentDriver — the autonomous "Brain" for the Computer capability (CE-3, ISSUE-1112).
 *
 * Mirrors BrowserAgentDriver.ts exactly in shape (capture -> reason -> act -> repeat,
 * max-step bounded, JSON action parsing) — the action space is screen coordinates instead
 * of CSS selectors, and the body is electronAPI.computer.* (CE-1/CE-2, ISSUE-1110/1111)
 * instead of electronAPI.agent.*. See docs/COMPUTER_EXECUTION_EXTENSION.md §3.4.
 *
 * Every step re-checks the kill switch BEFORE executing (§5.3) — a drive session must never
 * take an action after the user has hit abort, even if the abort raced the reasoning call.
 */

export interface ComputerAgentAction {
    thought: string;
    action: 'click' | 'type' | 'key' | 'scroll' | 'wait' | 'finish' | 'fail';
    params?: {
        x?: number;
        y?: number;
        button?: 'left' | 'right' | 'double';
        text?: string;
        combo?: string;
        dx?: number;
        dy?: number;
        durationMs?: number;
        reason?: string;
    };
}

export interface ComputerAgentStepResult {
    success: boolean;
    logs: string[];
    finalData?: unknown;
    steps: number;
}

async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class ComputerAgentDriver {
    /**
     * Drives the desktop to achieve a specific goal. Returns as soon as the model signals
     * 'finish'/'fail', the kill switch is triggered, or maxSteps is exceeded.
     */
    async drive(goal: string, maxSteps = 15): Promise<ComputerAgentStepResult> {
        const logs: string[] = [];
        logs.push(`[ComputerDriver] Starting drive. Goal: "${goal}"`);

        const api = window.electronAPI;
        if (!api?.computer) {
            throw new Error('Electron Computer API not available — computer_drive requires the indii desktop app.');
        }

        const permCheck = await api.computer.checkPermissions();
        if (!permCheck.success || !permCheck.data?.supported) {
            const reason = permCheck.error || permCheck.data?.guidance?.join(' ') || 'Computer control unsupported on this platform.';
            logs.push(`[ComputerDriver] Preflight failed: ${reason}`);
            return { success: false, logs, steps: 0 };
        }
        if (permCheck.data.screenRecording !== 'granted' || permCheck.data.accessibility !== 'granted') {
            const guidance = permCheck.data.guidance.join(' ');
            logs.push(`[ComputerDriver] Preflight failed: permissions not granted. ${guidance}`);
            return { success: false, logs, steps: 0 };
        }

        let step = 0;
        try {
            let screenshot = await api.computer.screenshot();
            if (!screenshot.success || !screenshot.data) {
                throw new Error(screenshot.error || 'Initial screenshot failed');
            }

            for (step = 1; step <= maxSteps; step++) {
                const abortState = await api.computer.getAbortState();
                if (abortState.data?.aborted) {
                    logs.push(`[ComputerDriver] Step ${step}: kill switch active — stopping.`);
                    return { success: false, logs, steps: step };
                }

                logs.push(`[ComputerDriver] Step ${step}/${maxSteps}: Analyzing state...`);

                const prompt = `
                    You are an autonomous computer-use agent. Your goal is: "${goal}".

                    Analyze the attached screenshot of the current desktop state and determine
                    the next action to take to achieve the goal.

                    Return a JSON object with this structure:
                    {
                        "thought": "Reasoning for your action",
                        "action": "click" | "type" | "key" | "scroll" | "wait" | "finish" | "fail",
                        "params": {
                            "x": number, "y": number, "button": "left" | "right" | "double" (click only),
                            "text": string (type only),
                            "combo": string like "cmd+c" (key only),
                            "dx": number, "dy": number (scroll only),
                            "durationMs": number (wait only),
                            "reason": string (finish/fail only)
                        }
                    }

                    Rules:
                    - NEVER click into or type text intended for a password, credential, payment
                      card, or 2FA field, even if asked. Choose 'fail' instead and explain why.
                    - If you see a popup/modal blocking progress, close it.
                    - If you have achieved the goal, choose 'finish'.
                    - If you cannot proceed safely or the goal is unreachable, choose 'fail'.
                `;

                const response = await AI.generateContent(
                    [
                        {
                            role: 'user',
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: 'image/png', data: screenshot.data.base64 } }
                            ]
                        }
                    ],
                    INTELLIGENCE_MODELS.COMPUTER.AGENT,
                    { responseMimeType: 'application/json', temperature: 0.0 }
                );

                const plan = AI.parseJSON(getResponseText(response)) as ComputerAgentAction;
                logs.push(`[ComputerDriver] Thought: ${plan.thought}`);
                logs.push(`[ComputerDriver] Action: ${plan.action} ${JSON.stringify(plan.params ?? {})}`);

                if (plan.action === 'finish') {
                    logs.push('[ComputerDriver] Goal achieved.');
                    return { success: true, logs, steps: step };
                }
                if (plan.action === 'fail') {
                    logs.push(`[ComputerDriver] Agent declined to proceed: ${plan.params?.reason}`);
                    return { success: false, logs, steps: step };
                }

                // Re-check the kill switch immediately before dispatch — the reasoning call
                // above can take seconds, long enough for the user to abort mid-thought.
                const preActionAbort = await api.computer.getAbortState();
                if (preActionAbort.data?.aborted) {
                    logs.push(`[ComputerDriver] Step ${step}: kill switch active before dispatch — stopping.`);
                    return { success: false, logs, steps: step };
                }

                const p = plan.params ?? {};
                let actionResult: { success: boolean; error?: string } | undefined;
                switch (plan.action) {
                    case 'click':
                        if (p.x === undefined || p.y === undefined) throw new Error('Missing x/y for click');
                        actionResult = await api.computer.click(p.x, p.y, p.button ?? 'left');
                        break;
                    case 'type':
                        if (!p.text) throw new Error('Missing text for type');
                        actionResult = await api.computer.type(p.text);
                        break;
                    case 'key':
                        if (!p.combo) throw new Error('Missing combo for key');
                        actionResult = await api.computer.key(p.combo);
                        break;
                    case 'scroll':
                        actionResult = await api.computer.scroll(p.dx ?? 0, p.dy ?? 0);
                        break;
                    case 'wait':
                        await new Promise(resolve => setTimeout(resolve, Math.min(p.durationMs ?? 1000, 5000)));
                        break;
                    default:
                        logs.push(`[ComputerDriver] Warning: unsupported action ${plan.action}`);
                }

                if (actionResult && !actionResult.success) {
                    logs.push(`[ComputerDriver] Action failed: ${actionResult.error}`);
                    if (actionResult.error && /kill switch/i.test(actionResult.error)) {
                        return { success: false, logs, steps: step };
                    }
                }

                const nextShot = await api.computer.screenshot();
                if (!nextShot.success || !nextShot.data) {
                    logs.push(`[ComputerDriver] Screenshot failed after action: ${nextShot.error}`);
                    return { success: false, logs, steps: step };
                }
                screenshot = nextShot;
            }

            logs.push('[ComputerDriver] Max steps exceeded.');
            return { success: false, logs, steps: maxSteps };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('[ComputerAgentDriver] drive error:', error);
            logs.push(`[ComputerDriver] Error: ${message}`);
            return { success: false, logs, steps: step };
        }
    }

    /** SHA-256 of a base64 screenshot payload, for audit trails that must not store raw frames. */
    async hashScreenshot(base64: string): Promise<string> {
        return sha256Hex(base64);
    }
}

export const computerAgentDriver = new ComputerAgentDriver();
