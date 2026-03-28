import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { InputNodeData, OutputNodeData, AudioSegmentNodeData, AnyAsset } from '../types';
import { Pencil, AudioWaveform, Play, Sparkles } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import UniversalNode from './UniversalNode';

// Re-export UniversalNode as DepartmentNode for backward compatibility in nodeTypes map
export const DepartmentNode = UniversalNode;
export const LogicNode = UniversalNode;

const NodeWrapper: React.FC<{ children: React.ReactNode, selected: boolean, className?: string }> = ({ children, selected, className = '' }) => (
    <div className={`
        bg-black/60 backdrop-blur-2xl rounded-2xl border text-white shadow-2xl relative overflow-hidden group/node transition-all duration-300
        ${selected ? 'border-teal-400 shadow-[0_0_30px_rgba(45,212,191,0.3)]' : 'border-white/10 hover:border-white/20'}
        ${className}
    `}>
        {children}
    </div>
);

export const InputNode = memo(({ id, data, selected }: NodeProps<InputNodeData>) => {
    const { nodes, setSelectedNodeId, setNodes } = useStore(useShallow(state => ({
        nodes: state.nodes,
        setSelectedNodeId: state.setSelectedNodeId,
        setNodes: state.setNodes
    })));

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newPrompt = e.target.value;
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) {
                return {
                    ...node,
                    data: { ...node.data, prompt: newPrompt }
                };
            }
            return node;
        }));
    };

    return (
        <NodeWrapper selected={selected} className="w-[280px]">
            {/* Standard Output Handle for Trigger/Text */}
            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="!bg-slate-400 !w-3 !h-3 !border-2 !border-[#1e293b]"
            />
            <div
                className="w-full h-full text-left rounded-lg relative group bg-gray-900/50"
                onClick={() => setSelectedNodeId(id)}
            >
                <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-teal-400 fill-teal-400/20" />
                        <p className="font-bold text-xs text-gray-200 uppercase tracking-wider">Start Trigger</p>
                    </div>
                </div>
                <div className="p-2">
                    <textarea
                        className="nodrag w-full min-h-[80px] bg-black/20 text-sm text-gray-300 italic resize-none outline-none placeholder:text-gray-600 focus:bg-white/5 border border-transparent focus:border-white/10 rounded-xl p-3 transition-colors"
                        value={data.prompt}
                        onChange={handleChange}
                        placeholder="Enter your prompt here..."
                    />
                </div>
            </div>
        </NodeWrapper>
    );
});

const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().substr(14, 5);

export const AudioSegmentNode = memo(({ data, selected }: NodeProps<AudioSegmentNodeData>) => {
    return (
        <NodeWrapper selected={selected} className="w-[280px] border-purple-500/30">
            <Handle
                type="source"
                position={Position.Right}
                id="audio_out"
                className="!bg-amber-400 !w-3 !h-3 !border-2 !border-[#1e293b]"
            />
            <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1 bg-purple-900/30 rounded">
                        <AudioWaveform className="w-4 h-4 text-purple-400" />
                    </div>
                    <p className="font-bold text-xs text-purple-300 uppercase tracking-wider">Audio Source</p>
                </div>
                <div className="bg-gray-900/50 p-2 rounded-md border border-gray-700/50">
                    <p className="text-gray-200 font-medium truncate text-sm" title={data.segmentLabel}>{data.segmentLabel}</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">{formatTime(data.startTime)} - {formatTime(data.endTime)}</p>
                </div>
            </div>
        </NodeWrapper>
    );
});


export const OutputNode = memo(({ data, selected }: NodeProps<OutputNodeData>) => {
    const resultIsAsset = typeof data.result === 'object' && data.result !== null;
    let displayText = 'Workflow output';
    if (resultIsAsset) {
        const asset = data.result as AnyAsset;
        displayText = `Asset: ${asset.title || asset.assetType}`;
    } else if (typeof data.result === 'string' && data.result) {
        displayText = `Report generated`;
    }

    return (
        <NodeWrapper selected={selected} className="w-[280px] border-green-500/30">
            <Handle
                type="target"
                position={Position.Left}
                id="input"
                className="!bg-slate-400 !w-3 !h-3 !border-2 !border-[#1e293b]"
            />
            <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1 bg-green-900/30 rounded">
                        <Sparkles className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="font-bold text-xs text-green-400 uppercase tracking-wider">Final Output</p>
                </div>
                <p className="text-xs text-gray-400 mt-1 p-2 bg-gray-900/50 rounded">{displayText}</p>
            </div>
        </NodeWrapper>
    );
});
