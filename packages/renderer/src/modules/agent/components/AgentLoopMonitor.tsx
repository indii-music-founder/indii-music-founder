import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { AgentLoopStatusEnum } from '@shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export const AgentLoopMonitor: React.FC = () => {
    // Select activeLoops from the store and convert to an array sorted by creation time
    const activeLoops = useStore(useShallow(state => state.activeLoops));
    const loops = Object.values(activeLoops).sort((a, b) => b.createdAt - a.createdAt);

    if (loops.length === 0) {
        return (
            <div className="p-8 text-center text-zinc-500 border border-dashed border-indii-surface-3 rounded-lg bg-indii-surface-1/50 backdrop-blur-sm">
                No active autonomous loops.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {loops.map(loop => (
                <Card key={loop.id} className="border-indii-surface-2 bg-indii-surface-1">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm text-indii-text-1">
                                Loop: <span className="font-mono text-xs">{loop.loopId}</span>
                            </CardTitle>
                            <Badge variant={loop.status === AgentLoopStatusEnum.enum.FAILED ? 'destructive' : loop.status === AgentLoopStatusEnum.enum.COMPLETED ? 'default' : 'secondary'}>
                                {loop.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-indii-text-2 mb-2 flex justify-between">
                            <span>Iteration: <strong>{loop.currentIteration}</strong></span>
                            <span>Updated: {new Date(loop.updatedAt).toLocaleTimeString()}</span>
                        </div>
                        <ScrollArea className="h-48 border border-indii-surface-3 rounded-md p-3 bg-black/20">
                            {loop.history.length === 0 && (
                                <div className="text-xs text-zinc-500 italic">Waiting for first action...</div>
                            )}
                            {loop.history.map((hist, idx) => (
                                <div key={idx} className="mb-4 border-b border-indii-surface-3 pb-3 last:border-0 last:mb-0 last:pb-0">
                                    <div className="text-xs font-semibold text-indii-text-1 mb-1">Iteration {hist.iteration}</div>
                                    <div className="text-xs text-indii-text-2 bg-indii-surface-2/50 p-2 rounded">
                                        <span className="font-semibold text-blue-400">Action:</span> {hist.output}
                                    </div>
                                    <div className="text-xs text-indii-text-2 mt-2 bg-indii-surface-2/50 p-2 rounded">
                                        <span className={`font-semibold ${hist.passed ? 'text-green-400' : 'text-orange-400'}`}>Judge:</span> {hist.feedback}
                                    </div>
                                </div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
