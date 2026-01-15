import React, { useState, useRef, useCallback } from 'react';
import * as fabric from 'fabric';
import { MerchLayout } from './components/Layout';
import { MerchButton } from './components/MerchButton';
import { DesignCanvas, useCanvasControls, CanvasObject } from './components/DesignCanvas';
import { AssetLibrary } from './components/AssetLibrary';
import { LayersPanel } from './components/LayersPanel';
import { AIGenerationDialog } from './components/AIGenerationDialog';
import EnhancedShowroom from './components/EnhancedShowroom';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { Undo, Redo, Download, Type, Monitor, LayoutTemplate, Sparkles, Bot, User as UserIcon, Save } from 'lucide-react';
import { Undo, Redo, Download, Type, Monitor, LayoutTemplate, Sparkles, Bot, User as UserIcon, Save, Layers, Sticker, Wand2 } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { cn } from '@/lib/utils';
import { MerchCard } from './components/MerchCard';

type WorkMode = 'agent' | 'user';
type ViewMode = 'design' | 'showroom';

// UI Components
const IconButton = ({ icon, onClick, label, disabled }: { icon: React.ReactNode, onClick: () => void, label?: string, disabled?: boolean }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
            "p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE135]",
            disabled && "opacity-30 cursor-not-allowed"
        )}
        aria-label={label}
        title={label}
    >
        {icon}
    </button>
);

const ColorSwatch = ({ color, active, onClick, className }: { color: string, active?: boolean, onClick: () => void, className?: string }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-6 h-6 rounded-full cursor-pointer transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE135]",
            active ? 'ring-2 ring-white scale-110' : 'hover:scale-110',
            className
        )}
        style={{ backgroundColor: color }}
        aria-label={`Select color ${color}`}
        title={`Select color ${color}`}
    />
);

const ModeToggle = ({ icon, label, active, onClick, 'data-testid': dataTestId }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, 'data-testid'?: string }) => (
    <button
        onClick={onClick}
        data-testid={dataTestId}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${active
            ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
            : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const ToolButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200",
            active
                ? 'bg-yellow-400 border-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20 hover:text-white'
        )}
        aria-label={label}
    >
        {icon}
        <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">{label}</span>
    </button>
);

const LayerItem = ({ label, active, visible, locked }: { label: string, active?: boolean, visible?: boolean, locked?: boolean }) => (
    <div className={`p-2 rounded flex items-center justify-between text-[11px] font-medium tracking-tight ${active ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' : 'text-neutral-500 hover:bg-white/5'}`}>
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-yellow-400' : 'bg-neutral-700'}`} />
            <span>{label}</span>
        </div>
        <div className="flex gap-2">
            {locked && <span className="text-[10px] opacity-20">🔒</span>}
            {visible && <span className="text-[10px] opacity-20">👁️</span>}
        </div>
    </div>
);

export default function MerchDesigner() {
    // View State
    const [viewMode, setViewMode] = useState<ViewMode>('design');
    const [workMode, setWorkMode] = useState<WorkMode>('user');
    const [designName, setDesignName] = useState('Untitled Design');
    const [isEditingName, setIsEditingName] = useState(false);

    // Canvas State
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const [layers, setLayers] = useState<CanvasObject[]>([]);
    const [selectedLayer, setSelectedLayer] = useState<CanvasObject | null>(null);
    const [exportedDesign, setExportedDesign] = useState<string | null>(null);

    // Dialog State
    const [showAIDialog, setShowAIDialog] = useState(false);

    const toast = useToast();

    // Canvas controls hook
    const {
        addImage,
        addText,
        deleteSelected,
        bringToFront,
        sendToBack,
        exportToImage,
        clear,
        setBackgroundColor
    } = useCanvasControls(fabricCanvasRef);

    // Canvas history hook (undo/redo)
    const { undo, redo, canUndo, canRedo } = useCanvasHistory(fabricCanvasRef.current);

    // Handle asset addition from library
    const handleAddAsset = useCallback(async (url: string, name: string) => {
        try {
            await addImage(url, name);
        } catch (error) {
            console.error('Failed to add asset:', error);
            toast.error('Failed to add asset to canvas');
        }
    }, [addImage, toast]);

    // Handle AI generated image
    const handleAIImageGenerated = useCallback(async (url: string, name: string) => {
        try {
            await addImage(url, name);
            toast.success('AI image added to canvas');
        } catch (error) {
            console.error('Failed to add AI image:', error);
            toast.error('Failed to add AI image');
        }
    }, [addImage, toast]);

    // Handle add text
    const handleAddText = useCallback(() => {
        addText('Your Text');
        toast.success('Text added to canvas');
    }, [addText, toast]);

    // Layer Management Handlers
    const handleSelectLayer = useCallback((layer: CanvasObject) => {
        if (!fabricCanvasRef.current) return;
        fabricCanvasRef.current.setActiveObject(layer.fabricObject);
        fabricCanvasRef.current.renderAll();
        setSelectedLayer(layer);
    }, []);

    const handleToggleVisibility = useCallback((layer: CanvasObject) => {
        layer.fabricObject.visible = !layer.fabricObject.visible;
        fabricCanvasRef.current?.renderAll();
        setLayers([...layers]);
    }, [layers]);

    const handleToggleLock = useCallback((targetLayer: CanvasObject) => {
        if (!fabricCanvasRef.current) return;

        const newLayers = layers.map(layer => {
            if (layer.id === targetLayer.id) {
                const newLocked = !layer.locked;
                // Update Fabric object
                layer.fabricObject.selectable = !newLocked;
                layer.fabricObject.evented = !newLocked;
                // Update React state object
                return { ...layer, locked: newLocked };
            }
            return layer;
        });

        fabricCanvasRef.current.renderAll();
        setLayers(newLayers);
    }, [layers]);

    const handleDeleteLayer = useCallback((layer: CanvasObject) => {
        fabricCanvasRef.current?.remove(layer.fabricObject);
        fabricCanvasRef.current?.renderAll();
    }, []);

    const handleReorderLayer = useCallback((layer: CanvasObject, direction: 'up' | 'down') => {
        if (!fabricCanvasRef.current) return;

        if (direction === 'up') {
            fabricCanvasRef.current.bringObjectForward(layer.fabricObject);
        } else {
            fabricCanvasRef.current.sendObjectBackwards(layer.fabricObject);
        }
        fabricCanvasRef.current.renderAll();
    }, []);

    const handleUpdateProperty = useCallback((layer: CanvasObject, property: string, value: any) => {
        layer.fabricObject.set(property as any, value);
        fabricCanvasRef.current?.renderAll();
    }, []);

    // Export to Showroom
    const handleExportToShowroom = useCallback(() => {
        const dataUrl = exportToImage();
        if (dataUrl) {
            setExportedDesign(dataUrl);
            setViewMode('showroom');
            toast.success('Design exported to Showroom');
        } else {
            toast.error('Failed to export design');
        }
    }, [exportToImage, toast]);

    // Save draft
    const handleSaveDraft = useCallback(() => {
        // TODO: Implement save to Firestore
        toast.success('Draft saved (not implemented yet)');
    }, [toast]);

    // Background color change
    const handleBackgroundColorChange = useCallback((color: string) => {
        setBackgroundColor(color);
    }, [setBackgroundColor]);

    // Work Mode Toggle
    const toggleWorkMode = useCallback(() => {
        const newMode = workMode === 'agent' ? 'user' : 'agent';
        setWorkMode(newMode);

        if (newMode === 'agent') {
            toast.success('Agent Mode: AI will help automate your workflow', 3000);
        } else {
            toast.success('User Mode: You have full manual control', 3000);
        }
    }, [workMode, toast]);

    const currentMode = viewMode;

    return (
        <MerchLayout>
            {viewMode === 'design' ? (

                <div className="h-full flex flex-col animate-in fade-in duration-500">
                    {/* Toolbar Header */}
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            {/* View Mode Toggle */}
                            <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-white/5">
                                <ModeToggle
                                    active={currentMode === 'design'}
                                    onClick={() => setViewMode('design')}
                                    icon={<LayoutTemplate size={16} />}
                                    label="Design"
                                    data-testid="mode-design-btn"
                                />
                                <ModeToggle
                                    active={currentMode === 'showroom'}
                                    onClick={handleExportToShowroom}
                                    icon={<Monitor size={16} />}
                                    label="Showroom"
                                    data-testid="mode-showroom-btn"
                                />
                            </div>

                            {/* Work Mode Toggle */}
                            <div className="relative">
                                <button
                                    onClick={toggleWorkMode}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${workMode === 'agent'
                                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                        : 'bg-blue-500/20 border-blue-500 text-blue-300'
                                        }`}
                                    title={workMode === 'agent' ? 'AI assists your workflow' : 'Full manual control'}
                                >
                                    {workMode === 'agent' ? (
                                        <>
                                            <Bot size={16} />
                                            <span>Agent Mode</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserIcon size={16} />
                                            <span>User Mode</span>
                                        </>
                                    )}
                                </button>
                                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 z-50`}>
                                    {workMode === 'agent' ? 'AI automation enabled' : 'Manual control'}
                                </div>
                            </div>

                            <div className="h-6 w-px bg-white/10 mx-2" />

                            {/* Undo/Redo */}
                            <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-white/5">
                                <IconButton
                                    icon={<Undo size={16} />}
                                    onClick={undo}
                                    disabled={!canUndo}
                                    title="Undo (Cmd+Z)"
                                />
                                <IconButton
                                    icon={<Redo size={16} />}
                                    onClick={redo}
                                    disabled={!canRedo}
                                    title="Redo (Cmd+Shift+Z)"
                                />
                                <IconButton icon={<Undo size={16} />} onClick={() => { }} disabled label="Undo" />
                                <IconButton icon={<Redo size={16} />} onClick={() => { }} disabled label="Redo" />
                            </div>

                            {/* Design Name */}
                            {isEditingName ? (
                                <input
                                    type="text"
                                    value={designName}
                                    onChange={(e) => setDesignName(e.target.value)}
                                    onBlur={() => setIsEditingName(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                                    autoFocus
                                    className="text-sm font-bold bg-neutral-900 border border-[#FFE135] rounded px-2 py-1 text-white focus:outline-none"
                                />
                            ) : (
                                <button
                                    onClick={() => setIsEditingName(true)}
                                    className="text-sm font-bold text-neutral-400 hover:text-white transition-colors"
                                >
                                    {designName}
                                </button>
                            )}
                        </div>
                        <span className="text-sm font-bold text-neutral-500">INDII_STREETWEAR_V1</span>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveDraft}
                                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                            >
                                <Save size={16} />
                                Save Draft
                            </button>
                            <MerchButton size="sm" onClick={handleExportToShowroom} glow>
                                <Download size={16} />
                                Export to Showroom
                            </MerchButton>
                        </div>
                    </header>

                    {/* Main Workspace */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
                        {/* Left Panel - Assets */}
                        <div className="flex flex-col overflow-hidden">
                            {/* Tool Buttons */}
                            <div className="flex gap-2 mb-4">
                                <ToolButton
                                    icon={<Type size={18} />}
                                    label="Text"
                                    onClick={handleAddText}
                                />
                                <ToolButton
                                    icon={<Sparkles size={18} />}
                                    label="AI Gen"
                                    onClick={() => setShowAIDialog(true)}
                                />
                            </div>

                            {/* Asset Library */}
                            <AssetLibrary
                                onAddAsset={handleAddAsset}
                                onGenerateAI={() => setShowAIDialog(true)}
                            />
                        </div>

                        {/* Center Canvas */}
                        <div className="lg:col-span-2 relative rounded-2xl border border-white/5 overflow-hidden">
                            <DesignCanvas
                                onLayersChange={setLayers}
                                onSelectionChange={setSelectedLayer}
                                onCanvasReady={(canvas) => {
                                    fabricCanvasRef.current = canvas;
                                }}
                            />

                            {/* Background Color Picker */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-20">
                                {['#000000', '#FFFFFF', '#FFE135', '#3B82F6', '#10B981', '#EF4444'].map(color => (
                                    <button
                                        key={color}
                                        onClick={() => handleBackgroundColorChange(color)}
                                        className="w-7 h-7 rounded-full border-2 border-white/20 hover:border-white/60 transition-all hover:scale-110"
                                        style={{ backgroundColor: color }}
                                        title={`Set background to ${color}`}
                                        aria-label={`Select color ${color}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Right Panel - Layers & Properties */}
                        <LayersPanel
                            layers={layers}
                            selectedLayer={selectedLayer}
                            onSelectLayer={handleSelectLayer}
                            onToggleVisibility={handleToggleVisibility}
                            onToggleLock={handleToggleLock}
                            onDeleteLayer={handleDeleteLayer}
                            onReorderLayer={handleReorderLayer}
                            onUpdateProperty={handleUpdateProperty}
                        />



                        {/* AI Generation Dialog */}
                        <AIGenerationDialog
                            isOpen={showAIDialog}
                            onClose={() => setShowAIDialog(false)}
                            onImageGenerated={handleAIImageGenerated}
                        />
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col animate-in slide-in-from-right duration-500">
                    {/* Showroom Mode Toolbar */}
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-white/5">
                                <ModeToggle
                                    active={currentMode === 'design'}
                                    onClick={() => setViewMode('design')}
                                    icon={<LayoutTemplate size={16} />}
                                    label="Design"
                                    data-testid="mode-design-btn"
                                />
                                <ModeToggle
                                    active={currentMode === 'showroom'}
                                    onClick={() => setViewMode('showroom')}
                                    icon={<Monitor size={16} />}
                                    label="Showroom"
                                    data-testid="mode-showroom-btn"
                                />
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Stage Live</span>
                            </div>
                        </div>
                        <MerchButton size="sm" onClick={() => setViewMode('design')}>
                            <LayoutTemplate size={16} />
                            Back to Canvas
                        </MerchButton>
                    </header>

                    {/* Enhanced Showroom */}
                    <div className="flex-1 overflow-hidden">
                        <EnhancedShowroom initialAsset={exportedDesign} />
                    </div>
                </div>
            )}
        </MerchLayout>
    );
}

// UI Components
const IconButton = ({ icon, onClick, disabled, title }: { icon: React.ReactNode, onClick: () => void, disabled?: boolean, title?: string }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
        {icon}
    </button>
);

const ModeToggle = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
            active
                ? 'bg-[#FFE135] text-black shadow-lg shadow-[#FFE135]/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/10'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const ToolButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
    <button
        onClick={onClick}
        className="flex-1 flex flex-col items-center justify-center p-3 rounded-xl border bg-neutral-900 border-white/5 text-neutral-400 hover:border-[#FFE135]/50 hover:text-[#FFE135] hover:bg-neutral-800 transition-all"
    >
        {icon}
        <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">{label}</span>
    </button>
);
