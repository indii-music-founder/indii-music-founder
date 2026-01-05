import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DepartmentNodeData, LogicNodeData, Status, AnyAsset } from '../types';
import { getNodeDefinition, getJobDefinition, DATA_TYPE_COLORS, DataType } from '../services/nodeRegistry';
import { CheckCircle, Hourglass, LoaderCircle, AlertTriangle, Settings, Pencil } from 'lucide-react';
import { useStore } from '@/core/store';

interface StatusStyle {
    icon: React.ElementType;
    color: string;
    animate?: boolean;
}

const statusConfig: Record<Status, StatusStyle> = {
    [Status.PENDING]: { icon: Hourglass, color: 'text-gray-400' },
    [Status.WORKING]: { icon: LoaderCircle, color: 'text-yellow-400', animate: true },
    [Status.DONE]: { icon: CheckCircle, color: 'text-green-400' },
    [Status.ERROR]: { icon: AlertTriangle, color: 'text-red-400' },
    [Status.WAITING_FOR_APPROVAL]: { icon: Hourglass, color: 'text-sky-400' },
};

// Combine types for props
type UniversalNodeData = DepartmentNodeData | LogicNodeData;

const UniversalNode = ({ id, data, selected }: NodeProps<UniversalNodeData>) => {
    const { nodes } = useStore();

    // 1. Resolve Definition
    // For logic nodes, departmentName is 'Logic'.
    const isLogic = data.nodeType === 'logic';
    const deptName = data.nodeType === 'department' ? data.departmentName : 'Logic';
    const jobId = data.nodeType === 'department' ? data.selectedJobId : (data.nodeType === 'logic' ? data.jobId : undefined);

    const nodeDefinition = getNodeDefinition(deptName);
    const jobDefinition = getJobDefinition(deptName, jobId);

    const status = statusConfig[data.status] || statusConfig[Status.PENDING];
    const StatusIcon = status.icon;
    const Icon = nodeDefinition?.icon || Settings;

    // 2. Result Rendering Logic
    const renderResultPreview = () => {
        if (data.status === Status.ERROR) {
            return <p className="text-red-400 text-[10px] p-2 break-all leading-tight">{String(data.result).substring(0, 50)}...</p>;
        }

        if (data.nodeType === 'logic') {
            const logicData = data as LogicNodeData;
            if (logicData.jobId === 'router') {
                return <div className="w-full h-full flex items-center justify-center bg-gray-900/50 text-indigo-300 text-[10px] px-2 text-center">Condition: {logicData.config?.condition || "Not set"}</div>;
            }
            if (logicData.jobId === 'gatekeeper') {
                return <div className="w-full h-full flex items-center justify-center bg-gray-900/50 text-indigo-300 text-[10px] px-2 text-center">Message: {logicData.config?.message || "Review needed"}</div>;
            }
        }

        if (!data.result || data.status !== Status.DONE) {
            return <div className="w-full h-full flex items-center justify-center bg-gray-900/50 text-gray-600 text-[10px] italic">Awaiting Output</div>;
        }

        let asset: AnyAsset;
        try {
            asset = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        } catch (e) {
            return <p className="text-gray-400 text-[10px] p-1 truncate">{String(data.result).substring(0, 30)}</p>;
        }

        if (asset?.assetType === 'image') return <img src={asset.imageUrl} alt="Result" className="w-full h-full object-cover" />;
        if (asset?.assetType === 'imageConceptSet') return <img src={asset.concepts[0].imageUrl} alt="Result" className="w-full h-full object-cover" />;
        if (asset?.assetType === 'video') return <video src={asset.videoUrl} className="w-full h-full object-cover" />;

        return <div className="p-2 text-[10px] text-gray-300 overflow-hidden leading-tight">{asset.title || 'Text Output'}</div>;
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Placeholder for openPromptEditor action
        // console.log("Edit node:", id);
    };

    // 3. Dynamic Handle Calculation
    // We distribute handles evenly along the sides
    const inputs = jobDefinition?.inputs || [{ id: 'default_in', label: 'Input', type: 'ANY' }];
    const outputs = jobDefinition?.outputs || [{ id: 'default_out', label: 'Output', type: 'ANY' }];

    const headerColor = isLogic ? 'bg-indigo-900/50 border-indigo-800' : 'bg-gray-800/50 border-gray-700';
    const borderColor = selected ? (isLogic ? 'border-indigo-500 shadow-indigo-500/20' : 'border-teal-500 shadow-teal-500/20') : 'border-gray-700 hover:border-gray-600';

    return (
        <div className={`
            w-64 bg-[#1e293b] rounded-lg shadow-lg border-2 transition-all duration-200 relative
            ${borderColor}
        `}>
            {/* Header */}
            <div className={`px-3 py-2 border-b ${headerColor} rounded-t-lg flex items-center justify-between`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`p-1 rounded ${selected ? (isLogic ? 'bg-indigo-800 text-indigo-300' : 'bg-teal-900/30 text-teal-400') : 'bg-gray-700/50 text-gray-400'}`}>
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-bold text-gray-200 truncate">{jobDefinition?.label || ('label' in data ? data.label : 'Node')}</p>
                        <p className="text-[10px] text-gray-500 truncate">{isLogic ? 'Control Flow' : ('departmentName' in data ? data.departmentName : 'Department')}</p>
                    </div>
                </div>
                <StatusIcon className={`w-3.5 h-3.5 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
            </div>

            {/* Body */}
            <div className="flex">
                {/* Input Handles Column */}
                <div className="flex flex-col justify-center py-3 gap-3 border-r border-gray-700/50 bg-gray-900/30 w-8 relative">
                    {inputs.map((input, _i) => (
                        <div key={input.id} className="relative group flex items-center justify-center h-3">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={input.id}
                                style={{
                                    left: -6,
                                    width: 8,
                                    height: 8,
                                    background: DATA_TYPE_COLORS[input.type as DataType],
                                    border: '2px solid #1e293b'
                                }}
                                className="transition-transform hover:scale-150"
                            />
                            {/* Tooltip for Input Type */}
                            <div className="absolute left-4 bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
                                {input.label} <span className="text-gray-500">({input.type})</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Content Preview */}
                <div className="flex-grow p-0 overflow-hidden relative group">
                    {/* Prompt/Config Preview Overlay */}
                    <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <p className="text-[10px] text-gray-300 line-clamp-2">
                            {isLogic ? 'Configure Node' : ('prompt' in data ? data.prompt : 'No prompt')}
                        </p>
                        <button
                            onClick={handleEdit}
                            className="absolute top-1 right-1 p-1 bg-gray-800 rounded text-gray-300 hover:text-white hover:bg-teal-600"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Result Preview */}
                    <div className="aspect-video w-full bg-gray-900 flex items-center justify-center">
                        {renderResultPreview()}
                    </div>
                </div>

                {/* Output Handles Column */}
                <div className="flex flex-col justify-center py-3 gap-3 border-l border-gray-700/50 bg-gray-900/30 w-8 relative">
                    {outputs.map((output, i) => (
                        <div key={output.id} className="relative group flex items-center justify-center h-3">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={output.id}
                                style={{
                                    right: -6,
                                    width: 8,
                                    height: 8,
                                    background: DATA_TYPE_COLORS[output.type as DataType],
                                    border: '2px solid #1e293b'
                                }}
                                className="transition-transform hover:scale-150"
                            />
                            {/* Tooltip for Output Type */}
                            <div className="absolute right-4 bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
                                {output.label} <span className="text-gray-500">({output.type})</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default memo(UniversalNode);
