import React, { useState } from 'react';
import { Megaphone, TrendingUp, PenTool, Target, BarChart, Globe } from 'lucide-react';
import AgentWindow from '../../core/components/AgentWindow';
import { DualAgentService } from '../../services/agent/DualAgentService';
import { MARKETING_TOOLS, MARKETING_MANAGER_PROMPT, MARKETING_EXECUTOR_PROMPT } from './tools';
import MapsComponent from './components/MapsComponent';

const marketingAgent = new DualAgentService(
    {
        name: "CMO",
        role: "Chief Marketing Officer",
        systemPrompt: MARKETING_MANAGER_PROMPT,
        tools: {} // Manager usually doesn't have tools, or we can pass empty
    },
    {
        name: "Copywriter",
        role: "Senior Copywriter",
        systemPrompt: MARKETING_EXECUTOR_PROMPT,
        tools: MARKETING_TOOLS
    }
);

export default function MarketingDashboard() {
    return (
        <div className="h-full flex flex-col bg-[#0a0a0a] text-white p-6">
            <header className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-pink-500/10 rounded-xl text-pink-400">
                    <Megaphone size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Marketing Command Center</h1>
                    <p className="text-gray-400">Campaign Strategy, Content Generation & Market Intelligence.</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Dashboard Area */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => marketingAgent.processGoal("Draft a launch campaign for a new AI feature targeting designers.")}
                            className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-pink-500/50 transition-all text-left group"
                        >
                            <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center mb-4 text-pink-400 group-hover:scale-110 transition-transform">
                                <Target size={20} />
                            </div>
                            <h3 className="font-medium mb-1">Launch Campaign</h3>
                            <p className="text-xs text-gray-500">Strategy & Timeline</p>
                        </button>

                        <button
                            onClick={() => marketingAgent.processGoal("Write a viral Twitter thread about the future of Generative UI.")}
                            className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-pink-500/50 transition-all text-left group"
                        >
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                                <PenTool size={20} />
                            </div>
                            <h3 className="font-medium mb-1">Social Copy</h3>
                            <p className="text-xs text-gray-500">Twitter & LinkedIn</p>
                        </button>

                        <button
                            onClick={() => marketingAgent.processGoal("Analyze current trends in the Creative AI industry.")}
                            className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-pink-500/50 transition-all text-left group"
                        >
                            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-4 text-green-400 group-hover:scale-110 transition-transform">
                                <TrendingUp size={20} />
                            </div>
                            <h3 className="font-medium mb-1">Market Trends</h3>
                            <p className="text-xs text-gray-500">Insights & Opportunities</p>
                        </button>
                    </div>

                    {/* Active Campaigns & Map */}
                    <div className="flex-1 bg-gray-900/30 rounded-2xl border border-gray-800 p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-medium flex items-center gap-2">
                                <Globe size={18} className="text-gray-400" />
                                Global Campaign Reach
                            </h3>
                            <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-full">Live Tracking</span>
                        </div>

                        <div className="flex-1 min-h-[300px] rounded-xl overflow-hidden relative">
                            <MapsComponent />
                        </div>
                    </div>
                </div>

                {/* Agent Sidebar */}
                <div className="bg-gray-900/30 rounded-2xl border border-gray-800 overflow-hidden">
                    <AgentWindow agent={marketingAgent} title="CMO & Copywriter" />
                </div>
            </div>
        </div>
    );
}
