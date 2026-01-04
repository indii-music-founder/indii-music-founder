import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { AgentTrace } from '@/services/agent/observability/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

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

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px] w-full p-4">
            {/* Trace List */}
            <Card className="col-span-1 h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Agent Traces</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full">
                        <div className="space-y-2 p-4">
                            {traces.map((trace) => (
                                <div
                                    key={trace.id}
                                    onClick={() => setSelectedTrace(trace)}
                                    className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${selectedTrace?.id === trace.id ? 'bg-muted border-primary' : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant={getStatusColor(trace.status) as any}>
                                            {trace.agentId}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {trace.startTime?.seconds ? formatDistanceToNow(new Date(trace.startTime.seconds * 1000), { addSuffix: true }) : 'Now'}
                                        </span>
                                    </div>
                                    <div className="text-sm line-clamp-2 text-muted-foreground">
                                        {trace.input}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Trace Details */}
            <Card className="col-span-2 h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Trace Details</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                    {selectedTrace ? (
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-6">
                                {/* Metadata Section */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-semibold text-muted-foreground">ID:</span> {selectedTrace.id}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-muted-foreground">Status:</span>
                                        <span className={`ml-2 uppercase font-bold ${selectedTrace.status === 'failed' ? 'text-red-500' : 'text-green-500'}`}>
                                            {selectedTrace.status}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-semibold text-muted-foreground">Input:</span>
                                        <div className="mt-1 p-2 bg-muted rounded font-mono text-xs">
                                            {selectedTrace.input}
                                        </div>
                                    </div>
                                    {selectedTrace.error && (
                                        <div className="col-span-2 text-red-500">
                                            <span className="font-semibold">Error:</span> {selectedTrace.error}
                                        </div>
                                    )}
                                </div>

                                {/* Steps Section */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold border-b pb-2">Execution Steps ({selectedTrace.steps?.length || 0})</h3>
                                    {selectedTrace.steps?.map((step, idx) => (
                                        <div key={idx} className="border rounded-md p-3 space-y-2">
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span className="uppercase font-bold tracking-wider">{step.type}</span>
                                                <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                                            </div>

                                            {/* Step Content */}
                                            <div className="text-sm font-mono bg-black/5 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                                {typeof step.content === 'string'
                                                    ? step.content
                                                    : JSON.stringify(step.content, null, 2)}
                                            </div>

                                            {/* Metadata if any */}
                                            {step.metadata && (
                                                <div className="text-xs text-muted-foreground mt-2">
                                                    <pre>{JSON.stringify(step.metadata, null, 2)}</pre>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            Select a trace to view details
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
