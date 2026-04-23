import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldAlert, Zap } from 'lucide-react';
import { agentOptimizer, OptimizationSuggestion } from '../../../services/agent/governance/AgentOptimizer';
import { useAuthStore } from '@/core/store/slices/authSlice';

export const SecurityDashboard: React.FC = () => {
    const { user } = useAuthStore();
    const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const loadSuggestions = async () => {
            if (!user?.uid) return;
            try {
                const optSuggestions = await agentOptimizer.analyzePerformance(user.uid);
                setSuggestions(optSuggestions);
            } catch (err) {
                console.error('Failed to load agent optimizations', err);
            } finally {
                setLoading(false);
            }
        };

        loadSuggestions();
    }, [user?.uid]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Security & Governance</h2>
                    <p className="text-muted-foreground">
                        Monitor Model Armor shields and review Agent Optimizer suggestions.
                    </p>
                </div>
                <Badge variant="outline" className="h-8 gap-2 px-3">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span>Armor Active</span>
                </Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Optimization Suggestions
                        </CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{suggestions.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Pending action
                        </p>
                    </CardContent>
                </Card>
                {/* Future cards for Shield Triggers and Agent Identity provenance */}
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Optimizer Recommendations</h3>
                {loading ? (
                    <div className="text-sm text-muted-foreground">Analyzing historical telemetry...</div>
                ) : suggestions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Agents are performing optimally. No suggestions at this time.</div>
                ) : (
                    <div className="space-y-4">
                        {suggestions.map((suggestion) => (
                            <Card key={suggestion.id} className="border-l-4 border-l-blue-500">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">
                                            {suggestion.agentId.toUpperCase()}
                                        </CardTitle>
                                        <Badge variant="secondary">
                                            {suggestion.type}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">
                                        {suggestion.description}
                                    </p>
                                    <div className="mt-4 flex items-center space-x-2 text-xs">
                                        <ShieldAlert className="h-4 w-4 text-yellow-500" />
                                        <span>Impact Score: {suggestion.impactScore}/100</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
