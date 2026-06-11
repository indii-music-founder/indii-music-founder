import { GoogleGenAI } from '@google/genai';
import * as logger from 'firebase-functions/logger';
import { AgentContext, PlannerAgent, GeneratorAgent, EvaluatorAgent, EvaluationResult } from './AgentTriad';

// Initialize the Gen AI SDK.
// Ensure VITE_API_KEY or GOOGLE_GENAI_API_KEY is available in the environment.
const ai = new GoogleGenAI({});

export class DefaultPlanner implements PlannerAgent {
    async plan(context: AgentContext, objective: string): Promise<string> {
        logger.info(`[DefaultPlanner] Planning for step ${context.stepId}`);
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `You are the Planner Agent. Your objective is: "${objective}". 
Please provide a step-by-step plan to achieve this objective. Do not execute the plan, only outline the approach.`,
            config: {
                temperature: 1.0,
            }
        });
        if (!response.text?.trim()) {
            throw new Error('Planner model returned an empty plan.');
        }
        return response.text;
    }
}

export class DefaultGenerator implements GeneratorAgent {
    async generate(context: AgentContext, objective: string, plan: string, feedback?: string): Promise<string> {
        logger.info(`[DefaultGenerator] Generating for step ${context.stepId}`);
        let prompt = `You are the Generator Agent. Your objective is: "${objective}".
Here is the plan to follow:
${plan}

Please execute this plan and provide the final output.`;

        if (feedback) {
            prompt += `\n\nPrevious attempt failed with this feedback: ${feedback}\nPlease adjust your output to address this feedback.`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                temperature: 1.0,
            }
        });
        if (!response.text?.trim()) {
            throw new Error('Generator model returned an empty result.');
        }
        return response.text;
    }
}

export class DefaultEvaluator implements EvaluatorAgent {
    async evaluate(context: AgentContext, objective: string, plan: string, result: string): Promise<EvaluationResult> {
        logger.info(`[DefaultEvaluator] Evaluating for step ${context.stepId}`);
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `You are the Evaluator Agent.
Objective: "${objective}"
Plan:
${plan}

Generated Result:
${result}

Did the generated result successfully achieve the objective and follow the plan?
If yes, respond EXACTLY with "PASS".
If no, respond with "FAIL" followed by a newline and specific feedback on what needs to be fixed.`,
            config: {
                temperature: 0.0,
            }
        });

        const text = response.text || 'FAIL\nEmpty response from evaluator.';
        if (text.trim().startsWith('PASS')) {
            return { passed: true };
        } else {
            return { passed: false, feedback: text.replace(/^FAIL\n?/, '').trim() };
        }
    }
}
