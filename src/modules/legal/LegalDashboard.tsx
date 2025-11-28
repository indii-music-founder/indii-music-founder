import React, { useState } from 'react';
import { DualAgentService } from '@/services/agent/DualAgentService';
import { LEGAL_TOOLS, LEGAL_MANAGER_PROMPT, LEGAL_EXECUTOR_PROMPT } from './tools';
import AgentWindow from '@/modules/creative/components/AgentWindow'; // Reuse for now

// Initialize the Dual Agent for Legal
const legalAgent = new DualAgentService(
    { name: 'Legal Manager', role: 'Manager', systemPrompt: LEGAL_MANAGER_PROMPT, tools: {} },
    { name: 'Legal Executor', role: 'Executor', systemPrompt: LEGAL_EXECUTOR_PROMPT, tools: LEGAL_TOOLS }
);

export default function LegalDashboard() {
    const [input, setInput] = useState('');

    const handleRequest = () => {
        if (!input.trim()) return;
        legalAgent.processGoal(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0f0f0f] text-gray-300 p-8">
            <h1 className="text-3xl font-special text-blue-500 mb-8">Legal Department</h1>

            <div className="max-w-2xl w-full mx-auto bg-[#1a1a1a] p-6 rounded-xl border border-gray-800">
                <h2 className="text-xl font-bold mb-4">Contract Review Request</h2>
                <textarea
                    className="w-full h-32 bg-[#0f0f0f] border border-gray-700 rounded p-3 text-sm mb-4 focus:border-blue-500 outline-none"
                    placeholder="Paste contract text or describe your legal request..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button
                    onClick={handleRequest}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition-colors"
                >
                    Submit to Legal Team
                </button>
            </div>

            {/* We reuse the AgentWindow to show the Dual Agent's internal monologue */}
            <AgentWindow />
        </div>
    );
}
