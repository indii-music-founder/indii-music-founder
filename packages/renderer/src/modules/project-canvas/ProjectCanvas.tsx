/**
 * ProjectCanvas.tsx
 *
 * Persistent, multi-modal Project Canvas for indii.music.
 * Uses a hardware-accelerated DOM spatial renderer with SVG semantic edges.
 *
 * Capabilities:
 * - Load by current project with zero cross-project leakage.
 * - Pan and zoom with mouse, keyboard, and trackpad.
 * - Move, resize, select, and multi-select blocks.
 * - Delete canvas placements (does not touch canonical entities).
 * - Drag-and-drop asset ingestion from library.
 * - Undo / Redo.
 * - Defensive auto-saving with save-race protection.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useProjectCanvas } from './hooks/useProjectCanvas';
import { AssetBlock } from './components/blocks/AssetBlock';
import { TextBlock } from './components/blocks/TextBlock';
import { FrameBlock } from './components/blocks/FrameBlock';
import { NoteBlock } from './components/blocks/NoteBlock';
import { WorkflowBlock } from './components/blocks/WorkflowBlock';
import { WorkflowRunBlock } from './components/blocks/WorkflowRunBlock';
import { AgentOutputBlock } from './components/blocks/AgentOutputBlock';
import { DocumentBlock } from './components/blocks/DocumentBlock';
import { ProjectEntityBlock } from './components/blocks/ProjectEntityBlock';
import { LODBlock } from './components/blocks/LODBlock';
import { ClusterBlock } from './components/blocks/ClusterBlock';
import { AddEntityModal } from './components/modals/AddEntityModal';
import { PromoteToWorkflowModal } from './components/modals/PromoteToWorkflowModal';
import { VersionComparisonModal } from './components/modals/VersionComparisonModal';
import { LifecycleTemplateModal } from './components/modals/LifecycleTemplateModal';
import { CanvasSnapshotModal } from './components/modals/CanvasSnapshotModal';
import { CanvasCommentModal } from './components/comments/CanvasCommentModal';
import { CanvasEdgeLayer } from './components/edges/CanvasEdgeLayer';
import { CanvasPresenceLayer } from './components/presence/CanvasPresenceLayer';
import { useCanvasVirtualization } from './hooks/useCanvasVirtualization';
import { useCanvasPresence } from './hooks/useCanvasPresence';
import { CanvasHUD } from './components/CanvasHUD';
import { CanvasToolbar } from './components/CanvasToolbar';
import { readCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';
import type { ProjectCanvasBlock } from './types';
import { logger } from '@/utils/logger';

export default function ProjectCanvas() {
    const {
        currentProjectId,
        currentCanvas,
        blocks,
        edges,
        selectedBlockIds,
        viewport,
        activeTool,
        isSaving,
        isDirty,
        saveError,
        lastSavedAt,
        setCanvasViewport,
        setActiveCanvasTool,
        selectCanvasBlock,
        clearCanvasSelection,
        addCanvasBlock,
        updateCanvasBlockPosition,
        updateCanvasBlockSize,
        updateCanvasBlock,
        removeCanvasBlockPlacement,
        removeCanvasEdge,
        undoCanvas,
        redoCanvas,
        saveProjectCanvas,
        retryCanvasSave,
        handleAddTextBlock,
        handleAddFrame,
    } = useProjectCanvas();

    const containerRef = useRef<HTMLDivElement>(null);

    // Pan / Drag State
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const lastPanPos = useRef({ x: 0, y: 0 });

    // Block Drag State
    const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const dragStartBlockPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

    // Block Resize State
    const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
    const resizeStartMousePos = useRef({ x: 0, y: 0 });
    const resizeStartSize = useRef({ width: 0, height: 0 });

    // Modals State
    const [isAddEntityOpen, setIsAddEntityOpen] = useState(false);
    const [addEntityDefaultTab, setAddEntityDefaultTab] = useState<'notes' | 'workflows' | 'assets' | 'create_note'>('notes');
    const [addEntityCenter, setAddEntityCenter] = useState<{ x: number; y: number }>({ x: 300, y: 300 });
    const [isPromoteOpen, setIsPromoteOpen] = useState(false);
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
    const [isSnapshotsOpen, setIsSnapshotsOpen] = useState(false);
    const [isCompareOpen, setIsCompareOpen] = useState(false);
    const [commentTargetBlock, setCommentTargetBlock] = useState<ProjectCanvasBlock | null>(null);
    const [comments, setComments] = useState<import('./types').CanvasComment[]>([]);

    const selectedAssetBlocks = blocks.filter(
        (b) => selectedBlockIds.includes(b.id) && b.type === 'asset'
    );

    // Track container dimensions for accurate spatial culling
    const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    });

    useEffect(() => {
        if (!containerRef.current) return;
        const updateDims = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    setContainerDimensions({ width: rect.width, height: rect.height });
                }
            }
        };
        updateDims();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateDims) : null;
        if (observer && containerRef.current) {
            observer.observe(containerRef.current);
        }
        window.addEventListener('resize', updateDims);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', updateDims);
        };
    }, []);

    // View Virtualization & Level of Detail (LOD) downsampling
    const {
        visibleBlocks,
        clusterSummaries = [],
        visibleEdges,
        isLowLOD,
        lodLevel,
    } = useCanvasVirtualization({
        blocks,
        edges,
        viewport,
        containerDimensions,
        selectedBlockIds,
        activeBlockId: draggingBlockId || resizingBlockId,
        cullingMargin: 400,
        virtualizationThreshold: 500,
    });

    const handleZoomToCluster = useCallback((summary: import('./types').CanvasClusterSummary) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clusterW = Math.max(300, summary.bounds.maxX - summary.bounds.minX + 200);
        const clusterH = Math.max(200, summary.bounds.maxY - summary.bounds.minY + 200);

        const zoomX = rect.width / clusterW;
        const zoomY = rect.height / clusterH;
        const targetZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.45), 1.2);

        const newX = rect.width / 2 - summary.center.x * targetZoom;
        const newY = rect.height / 2 - summary.center.y * targetZoom;

        setCanvasViewport({ x: Math.round(newX), y: Math.round(newY), zoom: targetZoom });
    }, [setCanvasViewport]);

    // Multiplayer Ephemeral Canvas Presence
    const {
        collaborators,
        updateCursor,
        clearCursor,
    } = useCanvasPresence({
        projectId: currentProjectId || '',
        canvasId: currentCanvas?.id || '',
        viewport,
        selectedBlockIds,
        containerRef,
        enabled: Boolean(currentProjectId && currentCanvas?.id),
    });

    const getCenterCanvasPosition = useCallback(() => {
        if (!containerRef.current) return { x: 300, y: 300 };
        const rect = containerRef.current.getBoundingClientRect();
        const cx = (rect.width / 2 - viewport.x) / viewport.zoom;
        const cy = (rect.height / 2 - viewport.y) / viewport.zoom;
        return { x: Math.round(cx - 150), y: Math.round(cy - 100) };
    }, [viewport]);

    const handleOpenAddEntity = useCallback((tab: 'notes' | 'workflows' | 'assets' | 'create_note' = 'notes') => {
        setAddEntityDefaultTab(tab);
        setAddEntityCenter(getCenterCanvasPosition());
        setIsAddEntityOpen(true);
    }, [getCenterCanvasPosition]);

    // ── Mouse & Wheel Navigation ──────────────────────────────────────────

    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (e.ctrlKey || e.metaKey) {
                // Zoom
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.15), 3.0);

                // Zoom centered on mouse pointer
                const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
                const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

                setCanvasViewport({ x: Math.round(newX), y: Math.round(newY), zoom: newZoom });
            } else {
                // Pan via trackpad / wheel
                setCanvasViewport({
                    x: Math.round(viewport.x - e.deltaX),
                    y: Math.round(viewport.y - e.deltaY),
                });
            }
        },
        [viewport, setCanvasViewport]
    );

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            // Middle-click or spacebar or Pan tool triggers panning
            if (e.button === 1 || isSpacePressed || activeTool === 'pan') {
                e.preventDefault();
                setIsPanning(true);
                lastPanPos.current = { x: e.clientX, y: e.clientY };
                return;
            }

            // Clicked on blank canvas background
            if (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-spatial-plane') {
                clearCanvasSelection();
            }
        },
        [isSpacePressed, activeTool, clearCanvasSelection]
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            // Multiplayer Presence: broadcast live cursor position
            updateCursor({ clientX: e.clientX, clientY: e.clientY });

            // Canvas Panning
            if (isPanning) {
                const dx = e.clientX - lastPanPos.current.x;
                const dy = e.clientY - lastPanPos.current.y;
                lastPanPos.current = { x: e.clientX, y: e.clientY };

                setCanvasViewport({
                    x: viewport.x + dx,
                    y: viewport.y + dy,
                });
                return;
            }

            // Block Dragging
            if (draggingBlockId) {
                const dx = (e.clientX - dragStartMousePos.current.x) / viewport.zoom;
                const dy = (e.clientY - dragStartMousePos.current.y) / viewport.zoom;

                dragStartBlockPositions.current.forEach((startPos, bId) => {
                    updateCanvasBlockPosition(bId, {
                        x: Math.round(startPos.x + dx),
                        y: Math.round(startPos.y + dy),
                    });
                });
                return;
            }

            // Block Resizing
            if (resizingBlockId) {
                const dx = (e.clientX - resizeStartMousePos.current.x) / viewport.zoom;
                const dy = (e.clientY - resizeStartMousePos.current.y) / viewport.zoom;

                updateCanvasBlockSize(resizingBlockId, {
                    width: Math.max(Math.round(resizeStartSize.current.width + dx), 150),
                    height: Math.max(Math.round(resizeStartSize.current.height + dy), 100),
                });
            }
        },
        [updateCursor, isPanning, draggingBlockId, resizingBlockId, viewport, setCanvasViewport, updateCanvasBlockPosition, updateCanvasBlockSize]
    );

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        setDraggingBlockId(null);
        setResizingBlockId(null);
        dragStartBlockPositions.current.clear();
    }, []);

    // ── Block Interaction Handlers ────────────────────────────────────────

    const handleStartBlockDrag = (e: React.MouseEvent, blockId: string) => {
        if (activeTool === 'pan' || isSpacePressed) return;
        e.stopPropagation();

        const isCurrentlySelected = selectedBlockIds.includes(blockId);
        const targetIds = isCurrentlySelected ? selectedBlockIds : [blockId];

        if (!isCurrentlySelected) {
            selectCanvasBlock(blockId, e.shiftKey || e.metaKey);
        }

        setDraggingBlockId(blockId);
        dragStartMousePos.current = { x: e.clientX, y: e.clientY };

        const positions = new Map<string, { x: number; y: number }>();
        for (const id of targetIds) {
            const b = blocks.find((item) => item.id === id);
            if (b) positions.set(id, { ...b.position });
        }
        dragStartBlockPositions.current = positions;
    };

    const handleStartResize = (e: React.MouseEvent, block: ProjectCanvasBlock) => {
        e.stopPropagation();
        setResizingBlockId(block.id);
        resizeStartMousePos.current = { x: e.clientX, y: e.clientY };
        resizeStartSize.current = { ...block.size };
    };

    // ── Keyboard Shortcuts ────────────────────────────────────────────────

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Spacebar for temporary pan
            if (e.code === 'Space' && !isSpacePressed && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault();
                setIsSpacePressed(true);
            }

            // Delete / Backspace removes placement
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIds.length > 0) {
                if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                    e.preventDefault();
                    selectedBlockIds.forEach((id) => removeCanvasBlockPlacement(id));
                }
            }

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redoCanvas();
                else undoCanvas();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redoCanvas();
            }

            // Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveProjectCanvas();
            }

            // Tool Shortcuts
            if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                if (e.key === 'v' || e.key === 'V') setActiveCanvasTool('select');
                if (e.key === 'h' || e.key === 'H') setActiveCanvasTool('pan');
                if (e.key === 't' || e.key === 'T') handleAddTextBlock('New Note');
                if (e.key === 'f' || e.key === 'F') handleAddFrame('Section');
                if (e.key === 'n' || e.key === 'N') handleOpenAddEntity('notes');
                if (e.key === 'w' || e.key === 'W') handleOpenAddEntity('workflows');
                if (e.key === 'a' || e.key === 'A') handleOpenAddEntity('assets');
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
                setIsPanning(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [
        isSpacePressed,
        selectedBlockIds,
        removeCanvasBlockPlacement,
        undoCanvas,
        redoCanvas,
        saveProjectCanvas,
        setActiveCanvasTool,
        handleAddTextBlock,
        handleAddFrame,
        handleOpenAddEntity,
    ]);

    // ── Drag & Drop Asset Ingestion ────────────────────────────────────────

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const dropX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
        const dropY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

        const dragData = readCreativeAssetDrag(e.dataTransfer);
        if (dragData?.asset) {
            const { asset } = dragData;
            addCanvasBlock({
                type: 'asset',
                position: { x: Math.round(dropX), y: Math.round(dropY) },
                size: { width: 320, height: 260 },
                entityRef: {
                    kind: 'asset',
                    entityId: asset.id,
                    sourceService: dragData.source,
                    projectId: currentProjectId,
                },
                snapshot: {
                    title: asset.name || asset.prompt || 'Imported Asset',
                    mediaType: asset.type === 'video' ? 'video' : asset.type === 'music' ? 'audio' : 'image',
                    thumbnailUrl: asset.thumbnailUrl || asset.url,
                    cachedAt: Date.now(),
                },
                provenance: {
                    creatorType: 'import',
                    creatorId: 'asset_drag_drop',
                    operation: dragData.source,
                    timestamp: Date.now(),
                },
            });
            logger.info(`[ProjectCanvas] Ingested dropped asset ${asset.id} at (${dropX}, ${dropY})`);
        }
    };

    // ── Zoom Navigation Controls ──────────────────────────────────────────

    const handleZoomIn = () => {
        const newZoom = Math.min(viewport.zoom * 1.2, 3.0);
        setCanvasViewport({ zoom: newZoom });
    };

    const handleZoomOut = () => {
        const newZoom = Math.max(viewport.zoom / 1.2, 0.15);
        setCanvasViewport({ zoom: newZoom });
    };

    const handleResetZoom = () => {
        setCanvasViewport({ zoom: 1 });
    };

    const handleFitAll = () => {
        if (blocks.length === 0 || !containerRef.current) {
            setCanvasViewport({ x: 0, y: 0, zoom: 1 });
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const b of blocks) {
            minX = Math.min(minX, b.position.x);
            minY = Math.min(minY, b.position.y);
            maxX = Math.max(maxX, b.position.x + b.size.width);
            maxY = Math.max(maxY, b.position.y + b.size.height);
        }

        const rect = containerRef.current.getBoundingClientRect();
        const contentW = maxX - minX + 100;
        const contentH = maxY - minY + 100;

        const zoomX = rect.width / contentW;
        const zoomY = rect.height / contentH;
        const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.2), 1.5);

        const newX = rect.width / 2 - ((minX + maxX) / 2) * newZoom;
        const newY = rect.height / 2 - ((minY + maxY) / 2) * newZoom;

        setCanvasViewport({ x: Math.round(newX), y: Math.round(newY), zoom: newZoom });
    };

    // Sort visible culled blocks by zIndex (Frames with zIndex 0 sit behind)
    const sortedBlocks = [...visibleBlocks].sort((a, b) => a.zIndex - b.zIndex);

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full bg-[#0d0f12] overflow-hidden select-none outline-none ${
                isPanning || isSpacePressed || activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={clearCursor}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            tabIndex={0}
            role="application"
            aria-label="Project Canvas Spatial Workspace"
        >
            {/* Background Dot Grid */}
            <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: 'radial-gradient(#52525b 1px, transparent 1px)',
                    backgroundSize: `${32 * viewport.zoom}px ${32 * viewport.zoom}px`,
                    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                }}
            />

            {/* Spatial Plane */}
            <div
                id="canvas-spatial-plane"
                className="absolute inset-0 origin-top-left"
                style={{
                    transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
                }}
            >
                {/* SVG Edge Connectors Layer (Downsampled at low zoom) */}
                <CanvasEdgeLayer
                    edges={visibleEdges}
                    blocks={blocks}
                    onRemoveEdge={removeCanvasEdge}
                    isLowLOD={isLowLOD}
                />

                {/* Multiplayer Presence Layer (Live collaborator cursors and selection halos) */}
                <CanvasPresenceLayer collaborators={collaborators} blocks={blocks} />

                {/* Aggregated Spatial Clusters (Ultra-dense scenes >= 500 blocks at overview zoom) */}
                {lodLevel === 'cluster' && clusterSummaries.map((cluster) => (
                    <ClusterBlock
                        key={cluster.id}
                        summary={cluster}
                        onZoomToCluster={handleZoomToCluster}
                    />
                ))}

                {/* Blocks Layer (Culled by viewport bounding-box) */}
                {sortedBlocks.map((block) => {
                    const isSelected = selectedBlockIds.includes(block.id);

                    return (
                        <div
                            key={block.id}
                            className="absolute cursor-move"
                            style={{
                                transform: `translate3d(${block.position.x}px, ${block.position.y}px, 0)`,
                                width: `${block.size.width}px`,
                                height: `${block.size.height}px`,
                                zIndex: block.zIndex,
                            }}
                            onMouseDown={(e) => handleStartBlockDrag(e, block.id)}
                        >
                            {/* Render Typed Block Content or Low-Zoom LOD Representation */}
                            {isLowLOD ? (
                                <LODBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onSelect={selectCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                />
                            ) : block.type === 'asset' ? (
                                <AssetBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : block.type === 'frame' ? (
                                <FrameBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : block.type === 'note' ? (
                                <NoteBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : block.type === 'workflow' ? (
                                <WorkflowBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : block.type === 'workflow_run' ? (
                                <WorkflowRunBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : block.type === 'agent_output' ? (
                                <AgentOutputBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : block.type === 'document' ? (
                                <DocumentBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : block.type === 'project_entity' ? (
                                <ProjectEntityBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            ) : (
                                <TextBlock
                                    block={block}
                                    isSelected={isSelected}
                                    onUpdate={updateCanvasBlock}
                                    onRemovePlacement={removeCanvasBlockPlacement}
                                    onSelect={selectCanvasBlock}
                                />
                            )}

                            {/* Resize Handle (Bottom-Right) */}
                            {isSelected && (
                                <div
                                    className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-cyan-500 rounded-full border-2 border-white cursor-se-resize shadow-md hover:scale-125 transition-transform"
                                    onMouseDown={(e) => handleStartResize(e, block)}
                                    title="Resize Block"
                                    aria-label="Resize block"
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Floating Toolbar (Top) */}
            <CanvasToolbar
                activeTool={activeTool}
                onSelectTool={setActiveCanvasTool}
                onQuickAddText={() => handleAddTextBlock('New Note')}
                onQuickAddFrame={() => handleAddFrame('Section')}
                onOpenAddEntity={handleOpenAddEntity}
                onPromoteSelection={() => setIsPromoteOpen(true)}
                selectedCount={selectedBlockIds.length}
                onOpenTemplates={() => setIsTemplatesOpen(true)}
                onOpenSnapshots={() => setIsSnapshotsOpen(true)}
                onOpenCompare={() => setIsCompareOpen(true)}
                canCompare={selectedAssetBlocks.length === 2}
                collaborators={collaborators}
            />

            {/* Heads-up Display (Bottom) */}
            <CanvasHUD
                viewport={viewport}
                isSaving={isSaving}
                isDirty={isDirty}
                saveError={saveError}
                lastSavedAt={lastSavedAt}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
                onFitAll={handleFitAll}
                onUndo={undoCanvas}
                onRedo={redoCanvas}
                onRetrySave={retryCanvasSave}
            />

            {/* Add Entity Modal */}
            <AddEntityModal
                isOpen={isAddEntityOpen}
                onClose={() => setIsAddEntityOpen(false)}
                onAddBlock={addCanvasBlock}
                defaultTab={addEntityDefaultTab}
                canvasId={currentCanvas?.id || `canvas_${currentProjectId || 'default'}`}
                projectId={currentProjectId || 'default'}
                centerPosition={addEntityCenter}
            />

            {/* Promote Selection to Workflow Modal */}
            <PromoteToWorkflowModal
                isOpen={isPromoteOpen}
                onClose={() => setIsPromoteOpen(false)}
                selectedBlocks={blocks.filter((b) => selectedBlockIds.includes(b.id))}
                onWorkflowCreated={(savedWorkflowId, workflowName) => {
                    const center = getCenterCanvasPosition();
                    const now = Date.now();
                    addCanvasBlock({
                        type: 'workflow',
                        position: center,
                        size: { width: 300, height: 220 },
                        zIndex: 1,
                        entityRef: {
                            kind: 'workflow',
                            entityId: savedWorkflowId,
                            projectId: currentProjectId || 'default',
                        },
                        snapshot: {
                            title: workflowName,
                            cachedAt: now,
                        },
                    });
                }}
            />

            {/* Version Comparison Modal */}
            {isCompareOpen && selectedAssetBlocks.length === 2 && (
                <VersionComparisonModal
                    isOpen={isCompareOpen}
                    onClose={() => setIsCompareOpen(false)}
                    blockA={selectedAssetBlocks[0]}
                    blockB={selectedAssetBlocks[1]}
                    onSelectPreferred={(preferredId) => {
                        updateCanvasBlock(selectedAssetBlocks[0].id, {
                            settings: { ...selectedAssetBlocks[0].settings, isPreferred: selectedAssetBlocks[0].id === preferredId },
                        });
                        updateCanvasBlock(selectedAssetBlocks[1].id, {
                            settings: { ...selectedAssetBlocks[1].settings, isPreferred: selectedAssetBlocks[1].id === preferredId },
                        });
                    }}
                />
            )}

            {/* Lifecycle Template Modal */}
            <LifecycleTemplateModal
                isOpen={isTemplatesOpen}
                onClose={() => setIsTemplatesOpen(false)}
            />

            {/* Canvas Snapshots Modal */}
            <CanvasSnapshotModal
                isOpen={isSnapshotsOpen}
                onClose={() => setIsSnapshotsOpen(false)}
            />

            {/* Canvas Comment Modal */}
            {commentTargetBlock && (
                <CanvasCommentModal
                    isOpen={Boolean(commentTargetBlock)}
                    onClose={() => setCommentTargetBlock(null)}
                    targetBlockId={commentTargetBlock.id}
                    targetTitle={commentTargetBlock.snapshot?.title || commentTargetBlock.id}
                    comments={comments}
                    onAddComment={(targetId, content) => {
                        const newComment: import('./types').CanvasComment = {
                            id: `comment_${Date.now()}`,
                            canvasId: currentCanvas?.id || 'default_canvas',
                            projectId: currentProjectId || 'default_proj',
                            targetType: 'block',
                            targetId,
                            authorId: 'artist_user',
                            authorName: 'Artist',
                            content,
                            createdAt: Date.now(),
                            resolved: false,
                        };
                        setComments((prev) => [newComment, ...prev]);
                    }}
                    onResolveComment={(commentId) => {
                        setComments((prev) =>
                            prev.map((c) =>
                                c.id === commentId ? { ...c, resolved: !c.resolved, resolvedAt: Date.now() } : c
                            )
                        );
                    }}
                />
            )}
        </div>
    );
}
