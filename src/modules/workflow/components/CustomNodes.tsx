import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { InputNodeData, OutputNodeData, AudioSegmentNodeData } from '../types';
import { Pencil, AudioWaveform, Play, Sparkles } from 'lucide-react';
import { useStore } from '../../../core/store';
import UniversalNode from './UniversalNode';

// Re-export UniversalNode as DepartmentNode for backward compatibility in nodeTypes map
export const DepartmentNode = UniversalNode;
export const LogicNode = UniversalNode;

const NodeWrapper: React.FC<{ children: React.ReactNode, selected: boolean, className?: string }> = ({ children, selected, className = '' }) => (
    <div className={`
        bg-gray-800/80 backdrop-blur-sm rounded-lg border-2 text-white shadow-md
        ${selected ? 'border-teal-500 shadow-xl' : 'border-gray-600'}
        ${className}
    `}>
        {children}
    </div>
);

export const InputNode = memo(({ id, data, selected }: NodeProps<InputNodeData>) => {
    const { nodes, setSelectedNodeId } = useStore();
    const node = nodes.find(n => n.id === id);

    return (
        <NodeWrapper selected={selected} className="w-64">
            {/* Standard Output Handle for Trigger/Text */}
            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="!bg-slate-400 !w-3 !h-3 !border-2 !border-[#1e293b]"
            />
            <button
                className="w-full h-full text-left cursor-pointer hover:bg-gray-700/30 rounded-lg relative group"
                onClick={() => setSelectedNodeId(id)}
            >
                <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-teal-400 fill-teal-400/20" />
                        <p className="font-bold text-xs text-gray-200 uppercase tracking-wider">Start Trigger</p>
                    </div>
                    <Pencil className="w-3 h-3 text-gray-500 group-hover:text-teal-400 transition-colors" />
                </div>
                <div className="p-3 text-sm text-gray-300 min-h-[80px] italic">
                    "{data.prompt}"
                </div>
            </button>
        </NodeWrapper>
    );
});

const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().substr(14, 5);

export const AudioSegmentNode = memo(({ data, selected }: NodeProps<AudioSegmentNodeData>) => {
    return (
        <NodeWrapper selected={selected} className="w-64 border-purple-500">
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
        // @ts-expect-error workflow result can be an asset object with optional title
        displayText = `Asset: ${data.result.title || data.result.assetType}`;
    } else if (typeof data.result === 'string' && data.result) {
        displayText = `Report generated`;
    }

    return (
        <NodeWrapper selected={selected} className="w-56 border-green-500/50">
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
