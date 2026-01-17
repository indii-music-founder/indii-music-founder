import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { AgentTrace } from '@/services/agent/observability/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { SwarmGraph } from './SwarmGraph';
import { XRayPanel } from './XRayPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, Network } from 'lucide-react';

export function TraceViewer() {
    const [traces, setTraces] = useState<AgentTrace[]>([]);
    const [selectedTrace, setSelectedTrace] = useState<AgentTrace | null>(null);

    useEffect(() => {
        const q = query(
            collection(db, 'agent_traces'),
            orderBy('startTime', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AgentTrace[];
            setTraces(data);
        });

        return () => unsubscribe();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'default'; // managed by badge variant usually, defaulting to primary
            case 'failed': return 'destructive';
            case 'pending': return 'secondary';
            default: return 'outline';
        }
    };

    const [activeTab, setActiveTab] = useState('list');

    return (
        <div className="flex flex-col h-full w-full p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">Agent Observability</h2>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-[400px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger
                            value="list"
                            className="flex items-center gap-2"
                            data-testid="list-trigger"
                        >
                            <LayoutGrid size={14} />
                            List View
                        </TabsTrigger>
                        <TabsTrigger
                            value="graph"
                            className="flex items-center gap-2"
                            data-testid="graph-trigger"
                        >
                            <Network size={14} />
                            Swarm Graph
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsContent value="list" className="flex-1 min-h-0 mt-0" data-testid="list-content">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                        {/* Trace List */}
                        <Card className="col-span-1 h-full flex flex-col bg-black/40 border-white/10">
                            <CardHeader className="py-4">
                                <CardTitle className="text-sm font-medium">Recent Traces</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden p-0 border-t border-white/5">
                                <ScrollArea className="h-full">
                                    <div className="space-y-1 p-2">
                                        {traces.map((trace) => (
                                            <div
                                                key={trace.id}
                                                onClick={() => setSelectedTrace(trace)}
                                                className={`p-3 rounded-md border border-transparent cursor-pointer hover:bg-white/5 transition-all ${selectedTrace?.id === trace.id ? 'bg-white/10 border-white/10 shadow-lg ring-1 ring-white/10' : ''
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <Badge variant={getStatusColor(trace.status) as any} className="text-[10px] py-0 px-1.5 h-4">
                                                        {trace.agentId}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {trace.startTime?.seconds ? formatDistanceToNow(new Date(trace.startTime.seconds * 1000), { addSuffix: true }) : 'Now'}
                                                    </span>
                                                </div>
                                                <div className="text-xs line-clamp-1 text-muted-foreground font-mono">
                                                    {trace.input}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Trace Details */}
                        <Card className="col-span-2 h-full flex flex-col bg-black/40 border-white/10 overflow-hidden">
                            <CardHeader className="py-4 border-b border-white/5">
                                <CardTitle className="text-sm font-medium flex justify-between items-center">
                                    <span>Execution Details</span>
                                    {selectedTrace && (
                                        <Badge variant="outline" className="font-mono text-[10px]">
                                            {selectedTrace.id.slice(0, 12)}
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-hidden p-0 relative">
                                {selectedTrace ? (
                                    <XRayPanel trace={selectedTrace} />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                                        Select a trace to view details
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="graph" className="flex-1 min-h-0 mt-0" data-testid="graph-content">
                    <Card className="h-full flex flex-col bg-black/40 border-white/10 overflow-hidden">
                        <div className="flex-1 relative flex">
                            <div className="flex-1 min-w-0">
                                <SwarmGraph
                                    swarmId={selectedTrace?.swarmId || selectedTrace?.id || ''}
                                    onNodeClick={(t) => setSelectedTrace(t)}
                                />
                            </div>
                            <div className="w-[350px] flex-shrink-0 border-l border-white/10 hidden lg:block">
                                <XRayPanel trace={selectedTrace} />
                            </div>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
