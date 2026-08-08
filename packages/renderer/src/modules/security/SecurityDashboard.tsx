import React from 'react';
import { Shield, Key, Activity, Lock } from 'lucide-react';
import { VisualVerificationsPane } from './VisualVerificationsPane';
import { AgentEncryptionPane } from './AgentEncryptionPane';
import { ApiCredentialsPane } from './ApiCredentialsPane';
import { AccessControlPane } from './AccessControlPane';

export default function SecurityDashboard() {
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-500/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="px-6 py-8 border-b border-white/5 relative z-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-linear-to-br from-blue-500 to-blue-400 rounded-lg shadow-lg shadow-blue-500/20">
                        <Shield size={20} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Security Center</h1>
                </div>
                <p className="text-sm text-gray-400 ml-12">
                    Manage your API keys, permissions, and security policies
                </p>
            </div>

            {/* 4-Pane Dashboard Content */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto h-full min-h-[600px]">
                    {/* Pane 1: Access Control */}
                    <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-colors flex flex-col min-h-[250px]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                <Lock size={20} />
                            </div>
                            <h2 className="text-lg font-bold text-white">Access Control</h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            Manage module permissions and access tiers for your organization.
                        </p>
                        <AccessControlPane />
                    </div>

                    {/* Pane 2: API Keys */}
                    <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-colors flex flex-col min-h-[250px]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                <Key size={20} />
                            </div>
                            <h2 className="text-lg font-bold text-white">API Credentials</h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            Configure integration keys and third-party secrets securely.
                        </p>
                        <ApiCredentialsPane />
                    </div>

                    {/* Pane 3: Audit Logs */}
                    <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-colors flex flex-col min-h-[250px]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                <Activity size={20} />
                            </div>
                            <h2 className="text-lg font-bold text-white">Audit Trail</h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            Review system events, logins, and permission changes.
                        </p>
                        <VisualVerificationsPane />
                    </div>

                    {/* Pane 4: Encryption & E2E */}
                    <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-colors flex flex-col min-h-[250px]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                                <Shield size={20} />
                            </div>
                            <h2 className="text-lg font-bold text-white">Agent Encryption</h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            Manage swarm protocol keys and A2A signature enforcement.
                        </p>
                        <AgentEncryptionPane />
                    </div>
                </div>
            </div>
        </div>
    );
}
