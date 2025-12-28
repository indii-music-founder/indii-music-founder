import React, { useState } from 'react';
import { Terminal, Copy, ChevronDown, ChevronUp, Play, X } from 'lucide-react';

interface TestProtocol {
    id: string;
    name: string;
    icon: string;
    scope: string;
    command: string;
    description: string;
}

const PROTOCOLS: TestProtocol[] = [
    {
        id: 'gauntlet',
        name: 'The Gauntlet',
        icon: '🛡️',
        scope: 'Onboarding & Critical Path',
        command: 'npx playwright test e2e/stress-test-new-user.spec.ts',
        description: 'Simulates a new user speedrun through the entire happy path.'
    },
    {
        id: 'director',
        name: 'The Director',
        icon: '🎬',
        scope: 'Video Editor State',
        command: 'npm test src/modules/video/TheDirector.test.tsx',
        description: 'Stress tests timeline operations (add, move, delete) and state integrity.'
    },
    {
        id: 'architect',
        name: 'The Architect',
        icon: '📐',
        scope: 'Workflow Engine',
        command: 'npm test src/modules/workflow/TheArchitect.test.tsx',
        description: 'Verifies node connection validation and logic flow constraints.'
    },
    {
        id: 'anarchist',
        name: 'The Anarchist',
        icon: 'Ⓐ',
        scope: 'Chaos & Resilience',
        command: 'npm test src/modules/video/TheAnarchist.test.tsx',
        description: 'Injects chaos inputs (NaN, negatives) and impossible states.'
    },
    {
        id: 'bouncer',
        name: 'The Bouncer',
        icon: '🦍',
        scope: 'Auth Logic',
        command: 'cd landing-page && npx vitest run app/TheBouncer.test.tsx',
        description: 'Verifies landing page auth redirects and UI states.'
    },
    {
        id: 'gatekeeper',
        name: 'The Gatekeeper',
        icon: '🔐',
        scope: 'Auth E2E',
        command: 'npx playwright test e2e/auth-flow.spec.ts',
        description: 'End-to-end verification of login, signup, and protected routes.'
    }
];

export default function TestPlaybookPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 border border-indigo-500/50 flex items-center gap-2 group"
                title="Open Test Playbook HUD"
            >
                <Terminal size={20} />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm font-medium">
                    Test Playbook
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-96 bg-[#0d1117] border border-gray-700 rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
            {/* Header */}
            <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between select-none cursor-pointer" onClick={() => setIsOpen(false)}>
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                    <Terminal size={18} />
                    <span>The Game Master</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-700 transition-colors"
                >
                    <ChevronDown size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="p-2 overflow-y-auto max-h-[60vh] custom-scrollbar space-y-2">
                {PROTOCOLS.map((protocol) => (
                    <div key={protocol.id} className="bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-md p-3 transition-colors group">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                    <span>{protocol.icon}</span>
                                    {protocol.name}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">{protocol.scope}</p>
                            </div>
                            <span className="text-[10px] uppercase font-mono bg-gray-900 text-gray-500 px-1.5 py-0.5 rounded border border-gray-800">
                                {protocol.command.startsWith('npx playwright') ? 'E2E' : 'UNIT'}
                            </span>
                        </div>

                        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                            {protocol.description}
                        </p>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 bg-gray-900 border border-gray-700 text-gray-400 font-mono text-[10px] px-2 flex items-center rounded-l-md w-full truncate pr-16 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                                $ {protocol.command}
                            </div>
                            <button
                                onClick={() => copyToClipboard(protocol.command, protocol.id)}
                                className="absolute right-0 top-0 bottom-0 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 rounded-r-md flex items-center gap-1.5 transition-colors z-10 w-full justify-center h-8"
                            >
                                {copiedId === protocol.id ? (
                                    <>
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={12} />
                                        <span>Copy Cmd</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reset Session Control */}
            <div className="p-3 border-t border-gray-800 bg-red-900/20">
                <button
                    onClick={async () => {
                        if (confirm('NUCLEAR RESET: This will clear all local storage, session storage, and sign out of Firebase. Continue?')) {
                            // Skip firebase logout
                            console.log("Resetting local state...");

                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.reload();
                        }
                    }
                    }
                    className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/20"
                >
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    NUCLEAR RESET SESSION
                </button>
            </div>

            {/* Footer */}
            <div className="p-2 bg-gray-900 border-t border-gray-800 text-[10px] text-gray-500 text-center font-mono">
                Only visible in development
            </div>
        </div >
    );
}
