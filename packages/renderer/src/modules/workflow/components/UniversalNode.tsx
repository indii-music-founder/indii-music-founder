import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
    DepartmentNodeData,
    LogicNodeData,
    SubgraphNodeData,
    Status,
    AnyAsset,
    NoteAsset,
    AudioQCAsset,
    MusicMetadataAsset,
    SplitSheetAsset,
    ReleasePackageAsset
} from '../types';
import { getNodeDefinition, getJobDefinition, DATA_TYPE_COLORS, DataType } from '../services/nodeRegistry';
import {
    CheckCircle,
    Hourglass,
    LoaderCircle,
    AlertTriangle,
    Settings,
    Pencil,
    FileText,
    Volume2,
    Music,
    Scale,
    ShieldCheck,
    Layers,
    LucideIcon
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

/**
 * Extended asset shape for workflow node results.
 * Covers Intelligence-generated images, concept sets, videos, generic outputs,
 * and music-industry typed assets (Notes, Audio QC, Metadata, Splits, Release Packages).
 */
interface WorkflowResultAsset extends AnyAsset {
    imageUrl?: string;
    videoUrl?: string;
    aiMetadata?: Record<string, unknown>;
    aiGenerationInfo?: Record<string, unknown>;
    base64?: string;
    mimeType?: string;
    label?: string;
    description?: string;
    concepts?: Array<{ imageUrl: string; aiMetadata?: Record<string, unknown> }>;
}

interface StatusStyle {
    icon: LucideIcon;
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
type UniversalNodeData = DepartmentNodeData | LogicNodeData | SubgraphNodeData;

const UniversalNode = ({ id, data, selected }: NodeProps<UniversalNodeData>) => {
    
    const { setSelectedNodeId } = useStore(useShallow(state => ({
        setSelectedNodeId: state.setSelectedNodeId
    })));

    // 1. Resolve Definition
    const isLogic = data.nodeType === 'logic';
    const isSubgraph = data.nodeType === 'subgraph';
    const deptName = data.nodeType === 'department'
        ? data.departmentName
        : (isSubgraph ? 'Micro-Workflows' : 'Logic');
    const jobId = data.nodeType === 'department'
        ? data.selectedJobId
        : (data.nodeType === 'logic' ? data.jobId : undefined);

    const nodeDefinition = getNodeDefinition(deptName);
    const jobDefinition = getJobDefinition(deptName, jobId);

    const status = statusConfig[data.status] || statusConfig[Status.PENDING];
    const StatusIcon = status.icon;
    const Icon = isSubgraph ? Layers : (nodeDefinition?.icon || Settings);

    const renderResultPreview = () => {
        if (data.status === Status.ERROR) {
            return <p className="text-red-400 text-[10px] p-2 break-all leading-tight">{String(data.result).substring(0, 50)}...</p>;
        }

        if (data.nodeType === 'subgraph') {
            const subgraphData = data as SubgraphNodeData;
            const subNodes = subgraphData.subgraph?.nodes || [];
            return (
                <div className="w-full h-full p-2.5 flex flex-col justify-between bg-pink-950/20 border border-pink-500/20 text-left">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-pink-400 text-[11px] font-semibold truncate">
                            <Layers className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{subgraphData.label || 'Micro-Workflow'}</span>
                        </div>
                        <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-pink-900/50 text-pink-300 border border-pink-500/30">
                            {subNodes.length} STEPS
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {subNodes.slice(0, 4).map((sn, idx) => (
                            <span key={idx} className="text-[8px] px-1 py-0.5 rounded bg-black/40 text-gray-300 border border-white/5 truncate max-w-[70px]">
                                {'label' in sn.data ? sn.data.label : ('departmentName' in sn.data ? sn.data.departmentName : sn.type)}
                            </span>
                        ))}
                        {subNodes.length > 4 && (
                            <span className="text-[8px] text-gray-500">+{subNodes.length - 4} more</span>
                        )}
                    </div>
                    <p className="text-[8px] text-pink-400/80 mt-1 truncate">
                        {subgraphData.description || 'Nested composite flow'}
                    </p>
                </div>
            );
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

        if (data.status !== Status.DONE) {
            return <div className="w-full h-full flex items-center justify-center bg-gray-900/50 text-gray-600 text-[10px] italic">Awaiting Output</div>;
        }

        if (!data.result) {
            return <div className="w-full h-full flex items-center justify-center bg-gray-900/50 text-gray-400 text-[10px] italic">Success: No Data Returned</div>;
        }

        // Deep check for result structure
        let asset: (WorkflowResultAsset | NoteAsset | AudioQCAsset | MusicMetadataAsset | SplitSheetAsset | ReleasePackageAsset) | null = null;
        try {
            const rawResult = typeof data.result === 'string' && data.result.startsWith('{')
                ? JSON.parse(data.result)
                : data.result;

            if (rawResult && typeof rawResult === 'object') {
                if ('images' in rawResult && Array.isArray((rawResult as { images: Array<{ imageUrl?: string; mimeType?: string; bytesBase64Encoded?: string; base64?: string }> }).images)) {
                    const firstImage = (rawResult as { images: Array<{ imageUrl?: string; mimeType?: string; bytesBase64Encoded?: string; base64?: string }> }).images[0];
                    asset = {
                        assetType: 'image',
                        imageUrl: firstImage?.imageUrl || `data:${firstImage?.mimeType || 'image/png'};base64,${firstImage?.bytesBase64Encoded || firstImage?.base64}`,
                        aiMetadata: (rawResult as Record<string, unknown>).aiMetadata as Record<string, unknown> | undefined,
                        aiGenerationInfo: (rawResult as Record<string, unknown>).aiGenerationInfo as Record<string, unknown> | undefined,
                        title: 'Autonomous Generated Artwork'
                    };
                } else {
                    asset = rawResult as WorkflowResultAsset;
                }
            }
        } catch (_e: unknown) {
            return <p className="text-gray-400 text-[10px] p-1 truncate">{String(data.result).substring(0, 30)}</p>;
        }

        if (!asset) return <div className="w-full h-full flex items-center justify-center bg-gray-900/50 text-gray-600 text-[10px] italic">No Data</div>;

        // ── Notes Asset Rendering ──────────────────────────────────────────
        if (asset.assetType === 'note') {
            const noteAsset = asset as NoteAsset;
            return (
                <div className="w-full h-full p-2.5 flex flex-col justify-between bg-emerald-950/30 border border-emerald-500/20 text-left">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{noteAsset.title}</span>
                    </div>
                    <p className="text-[9px] text-gray-400 line-clamp-3 leading-relaxed mt-1">
                        {noteAsset.content}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-[8px] text-emerald-500">
                        <span className="px-1 py-0.5 rounded bg-emerald-900/50 border border-emerald-500/30">Notes Module Synced</span>
                    </div>
                </div>
            );
        }

        // ── Audio QC Asset Rendering ───────────────────────────────────────
        if (asset.assetType === 'audio_qc') {
            const qc = asset as AudioQCAsset;
            return (
                <div className="w-full h-full p-2.5 flex flex-col justify-between bg-amber-950/30 border border-amber-500/20 text-left">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold">
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Audio QC Report</span>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${qc.pass ? 'bg-green-500/20 text-green-300 border border-green-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'}`}>
                            {qc.pass ? 'PASSED' : 'FLAGGED'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[9px] text-gray-300 mt-1">
                        <div>LUFS: <span className="font-mono text-amber-300">{qc.integratedLufs} dB</span></div>
                        <div>True Peak: <span className="font-mono text-amber-300">{qc.truePeakDbfs} dBFS</span></div>
                    </div>
                    <p className="text-[8px] text-gray-400 truncate mt-1">DSP Target: -14 LUFS / -1.0 dBFS</p>
                </div>
            );
        }

        // ── Music Metadata Asset Rendering ────────────────────────────────
        if (asset.assetType === 'metadata') {
            const meta = asset as MusicMetadataAsset;
            return (
                <div className="w-full h-full p-2.5 flex flex-col justify-between bg-sky-950/30 border border-sky-500/20 text-left">
                    <div className="flex items-center gap-1.5 text-sky-400 text-[11px] font-semibold truncate">
                        <Music className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{meta.title}</span>
                    </div>
                    <div className="text-[9px] text-gray-300 mt-1 space-y-0.5">
                        <p className="truncate">Artist: <span className="text-gray-100">{meta.primaryArtist}</span></p>
                        {meta.isrc && <p className="font-mono text-[8px] text-sky-300">ISRC: {meta.isrc}</p>}
                        {meta.upc && <p className="font-mono text-[8px] text-sky-300">UPC: {meta.upc}</p>}
                    </div>
                    <div className="text-[8px] text-sky-500 font-mono truncate">{meta.genre} • {meta.releaseDate}</div>
                </div>
            );
        }

        // ── Splits Asset Rendering ────────────────────────────────────────
        if (asset.assetType === 'splits') {
            const splits = asset as SplitSheetAsset;
            return (
                <div className="w-full h-full p-2.5 flex flex-col justify-between bg-purple-950/30 border border-purple-500/20 text-left">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-purple-300 text-[11px] font-semibold">
                            <Scale className="w-3.5 h-3.5" />
                            <span>Split Sheet</span>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/40">
                            100% BALANCED
                        </span>
                    </div>
                    <p className="text-[9px] text-gray-300 mt-1 truncate">{splits.trackTitle}</p>
                    <p className="text-[8px] text-purple-400">
                        {splits.contributors?.length || 0} Registered Collaborators (Master & Publishing)
                    </p>
                </div>
            );
        }

        // ── Release Package Asset Rendering ────────────────────────────────
        if (asset.assetType === 'release_package') {
            const pkg = asset as ReleasePackageAsset;
            return (
                <div className="w-full h-full p-2.5 flex flex-col justify-between bg-rose-950/30 border border-rose-500/20 text-left">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-rose-300 text-[11px] font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>DDEX Pre-Flight</span>
                        </div>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${pkg.readyForDelivery ? 'bg-green-500/20 text-green-300 border border-green-500/40' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'}`}>
                            {pkg.readyForDelivery ? 'READY FOR DSP' : 'INCOMPLETE'}
                        </span>
                    </div>
                    <p className="text-[9px] text-gray-300 truncate mt-1">{pkg.trackTitle} — {pkg.primaryArtist}</p>
                    <div className="text-[8px] text-gray-400 flex items-center gap-2">
                        <span>QC: {pkg.qcPassed ? '✓' : '✗'}</span>
                        <span>ISRC: {pkg.isrc ? '✓' : '✗'}</span>
                        <span>Splits: {pkg.splitsVerified ? '✓' : '✗'}</span>
                    </div>
                </div>
            );
        }

        if (asset.assetType === 'image') return (
            <div className="relative w-full h-full">
                <img src={(asset as WorkflowResultAsset).imageUrl ?? ''} alt="Result" className="w-full h-full object-cover" />
                {(asset as WorkflowResultAsset).aiMetadata && (
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] text-teal-400 border border-teal-500/50 backdrop-blur-sm">
                        Autonomous Provenance Locked
                    </div>
                )}
            </div>
        );
        if (asset.assetType === 'imageConceptSet') {
            const firstConcept = (asset as WorkflowResultAsset).concepts?.[0];
            return (
                <div className="relative w-full h-full">
                    <img src={firstConcept?.imageUrl} alt="Result" className="w-full h-full object-cover" />
                    {firstConcept?.aiMetadata && (
                        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] text-teal-400 border border-teal-500/50 backdrop-blur-sm">
                            Autonomous Provenance Locked
                        </div>
                    )}
                </div>
            );
        }
        if (asset.assetType === 'video') return <video src={(asset as WorkflowResultAsset).videoUrl ?? ''} className="w-full h-full object-cover" />;

        const resultString = String(data.result);
        if (resultString.startsWith('data:image/') || (asset as WorkflowResultAsset).base64) {
            const src = (asset as WorkflowResultAsset).base64 ? `data:${(asset as WorkflowResultAsset).mimeType || 'image/png'};base64,${(asset as WorkflowResultAsset).base64}` : resultString;
            return (
                <div className="relative w-full h-full">
                    <img src={src} alt="AI Result" className="w-full h-full object-cover" />
                    {(asset as WorkflowResultAsset).aiMetadata && (
                        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] text-teal-400 border border-teal-500/50 backdrop-blur-sm flex items-center gap-1">
                            <div className="w-1 h-1 bg-teal-500 rounded-full animate-pulse" />
                            Autonomous Provenance Locked
                        </div>
                    )}
                </div>
            );
        }

        const displayLabel = String(asset.title || asset.label || asset.description || (typeof asset === 'string' ? asset : 'Output Received'));
        return <div className="p-2 text-[10px] text-gray-300 overflow-hidden leading-tight">{displayLabel}</div>;
    };

    /**
     * Handles clicking the edit button. Sets this node as the selected node
     * in the store, which opens/focuses the Node Inspector sidebar.
     */
    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedNodeId(id);
    };

    // 3. Dynamic Handle Calculation
    const inputs = isSubgraph
        ? [{ id: 'default_in', label: 'Input Flow', type: 'ANY' as DataType }]
        : (jobDefinition?.inputs || [{ id: 'default_in', label: 'Input', type: 'ANY' as DataType }]);
    const outputs = isSubgraph
        ? [{ id: 'default_out', label: 'Output Flow', type: 'ANY' as DataType }]
        : (jobDefinition?.outputs || [{ id: 'default_out', label: 'Output', type: 'ANY' as DataType }]);

    const headerColor = isSubgraph
        ? 'bg-pink-900/40 border-pink-500/30'
        : (isLogic ? 'bg-indigo-900/40 border-indigo-500/30' : 'bg-white/5 border-white/10');
    const borderColor = selected
        ? (isSubgraph
            ? 'border-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.3)] shadow-pink-500/20'
            : (isLogic
                ? 'border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.3)] shadow-indigo-500/20'
                : 'border-teal-400 shadow-[0_0_30px_rgba(45,212,191,0.3)] shadow-teal-500/20'))
        : (isSubgraph ? 'border-pink-500/30 hover:border-pink-500/50' : 'border-white/10 hover:border-white/20');

    return (
        <div className={`
            w-[280px] bg-black/60 backdrop-blur-2xl rounded-2xl shadow-2xl border transition-all duration-300 relative overflow-visible group/node
            ${borderColor}
        `}>
            {/* Header */}
            <div className={`px-4 py-3 border-b ${headerColor} flex items-center justify-between backdrop-blur-sm z-10 relative`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-1.5 rounded-lg ${selected ? (isSubgraph ? 'bg-pink-500/20 text-pink-300' : (isLogic ? 'bg-indigo-500/20 text-indigo-300' : 'bg-teal-500/20 text-teal-300')) : 'bg-white/10 text-gray-400 group-hover/node:bg-white/20 transition-colors'}`}>
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-bold text-gray-200 truncate">
                            {isSubgraph ? ('label' in data ? data.label : 'Micro-Workflow') : (jobDefinition?.label || ('label' in data ? data.label : 'Node'))}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                            {isSubgraph ? 'Composite Subgraph' : (isLogic ? 'Control Flow' : ('departmentName' in data ? data.departmentName : 'Department'))}
                        </p>
                    </div>
                </div>
                <StatusIcon className={`w-3.5 h-3.5 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
            </div>

            {/* Body */}
            <div className="flex relative z-0 bg-linear-to-b from-transparent to-black/40">
                {/* Input Handles Column */}
                <div className="flex flex-col justify-center py-4 gap-4 border-r border-white/5 bg-black/20 w-10 relative">
                    {inputs.map((input, _i) => (
                        <div key={input.id} className="relative group flex items-center justify-center h-4">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={input.id}
                                style={{
                                    left: -6,
                                    width: 8,
                                    height: 8,
                                    background: DATA_TYPE_COLORS[input.type as DataType] || DATA_TYPE_COLORS.ANY,
                                    border: '2px solid #1e293b'
                                }}
                                className="z-20 transition-transform hover:scale-150"
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
                    <div className="absolute top-0 left-0 right-0 p-2 bg-linear-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <p className="text-[10px] text-gray-300 line-clamp-2">
                            {isSubgraph ? 'Composite Micro-Flow' : (isLogic ? 'Configure Node' : ('prompt' in data ? data.prompt : 'No prompt'))}
                        </p>
                        <button
                            onClick={handleEdit}
                            className="absolute top-1 right-1 p-1 bg-gray-800 rounded text-gray-300 hover:text-white hover:bg-teal-600"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Result Preview */}
                    <div className="aspect-video w-full bg-black/40 flex items-center justify-center overflow-hidden">
                        {renderResultPreview()}
                    </div>
                </div>

                {/* Output Handles Column */}
                <div className="flex flex-col justify-center py-4 gap-4 border-l border-white/5 bg-black/20 w-10 relative">
                    {outputs.map((output, _i) => (
                        <div key={output.id} className="relative group flex items-center justify-center h-4">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={output.id}
                                style={{
                                    right: -6,
                                    width: 8,
                                    height: 8,
                                    background: DATA_TYPE_COLORS[output.type as DataType] || DATA_TYPE_COLORS.ANY,
                                    border: '2px solid #1e293b'
                                }}
                                className="z-20 transition-transform hover:scale-150"
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
