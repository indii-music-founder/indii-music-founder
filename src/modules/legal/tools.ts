import { AI } from '@/services/ai/AIService';

export const LEGAL_TOOLS = {
    analyze_contract: async (args: { text: string }) => {
        const prompt = `
        ROLE: Senior Legal Analyst
        TASK: Analyze the following contract text. Identify key risks, missing clauses, and provide a summary.
        CONTRACT TEXT:
        ${args.text}
        
        OUTPUT FORMAT: Markdown.
        `;
        const res = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return res.text() || "Analysis failed.";
    },
    check_compliance: async (args: { region: string }) => {
        const prompt = `
        ROLE: Compliance Officer
        TASK: Check regulatory compliance requirements for region: ${args.region}.
        OUTPUT: Brief summary of key regulations.
        `;
        const res = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return res.text() || "Compliance check failed.";
    }
};

export const LEGAL_MANAGER_PROMPT = `
You are the Legal Department Manager (Senior Counsel).
Your goal is to ensure all legal tasks are executed with 100% accuracy and risk mitigation.
You create plans for the Executor and strictly critique their work.
`;

export const LEGAL_EXECUTOR_PROMPT = `
You are the Legal Department Executor (Paralegal/Junior Associate).
You execute legal tasks using your tools.
You follow the Manager's plan exactly.
`;
