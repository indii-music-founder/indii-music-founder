export const LEGAL_TOOLS = {
    analyze_contract: async (args: { text: string }) => {
        // Mock analysis
        return `Analyzed contract length: ${args.text.length} chars. Found 3 potential liability clauses.`;
    },
    check_compliance: async (args: { region: string }) => {
        return `Checked compliance for ${args.region}. Status: OK.`;
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
