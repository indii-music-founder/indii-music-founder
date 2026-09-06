import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { Button } from '@/components/ui/button';
import { AgentCanvasToggle } from '@/core/components/AgentCanvasToggle';
import CanvasModePicker from '@/modules/creative/components/CanvasModePicker';
import { MarketingToolbar } from '@/modules/marketing/components/MarketingToolbar';
import { ExportBar } from '@/modules/creative/components/CanvasEditor/ExportBar';
import { LayerList } from '@/modules/creative/components/CanvasEditor/LayerList';
import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/constants';
import type { RasterLayer } from '@/services/canvas/CanvasDoc';
import type { CanvasPushPayload } from '@/types/AgentCanvas';

// Mock Lucide icons for stable rendering
vi.mock('lucide-react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('lucide-react')>();
    return {
        ...actual,
        Loader2: ({ className }: { className?: string }) => <div data-testid="loader-icon" className={className}>Loading...</div>,
    };
});

// Mock ProjectList to isolate Sidebar button testing
vi.mock('@/core/components/sidebar/ProjectList', () => ({
    ProjectList: () => <div data-testid="mock-project-list" />,
}));

describe('Global Button Action Audit Suite', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Core Button Primitive Interactions', () => {
        it('triggers onClick handler exactly once on user click', () => {
            const handleClick = vi.fn();
            render(<Button onClick={handleClick} data-testid="test-action-btn">Trigger Action</Button>);

            const btn = screen.getByTestId('test-action-btn');
            expect(btn).toBeEnabled();
            fireEvent.click(btn);
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('disables execution and suppresses clicks when disabled or loading', () => {
            const handleClick = vi.fn();
            const { rerender } = render(<Button disabled onClick={handleClick} data-testid="test-disabled-btn">Disabled Action</Button>);

            const disabledBtn = screen.getByTestId('test-disabled-btn');
            expect(disabledBtn).toBeDisabled();
            fireEvent.click(disabledBtn);
            expect(handleClick).not.toHaveBeenCalled();

            rerender(<Button isLoading onClick={handleClick} data-testid="test-disabled-btn">Loading Action</Button>);
            const loadingBtn = screen.getByTestId('test-disabled-btn');
            expect(loadingBtn).toBeDisabled();
            expect(loadingBtn).toHaveAttribute('data-loading', 'true');
            fireEvent.click(loadingBtn);
            expect(handleClick).not.toHaveBeenCalled();
        });
    });

    describe('AgentCanvasToggle Component Interactions', () => {
        it('invokes toggleCanvas store handler on click across all variants', () => {
            const toggleCanvas = vi.fn();
            const mockPanels: CanvasPushPayload[] = [{
                id: 'doc-1',
                title: 'Spec 1',
                type: 'markdown',
                data: { content: 'content' },
                agentId: 'creative',
                createdAt: Date.now(),
            }];

            useStore.setState({
                isCanvasOpen: false,
                canvasPanels: mockPanels,
                toggleCanvas,
            });

            const { unmount } = render(<AgentCanvasToggle variant="header" />);
            const headerBtn = screen.getByTestId('agent-canvas-toggle-btn');
            expect(headerBtn).toHaveAttribute('aria-expanded', 'false');
            fireEvent.click(headerBtn);
            expect(toggleCanvas).toHaveBeenCalledTimes(1);
            unmount();

            render(<AgentCanvasToggle variant="sidebar" />);
            const sidebarBtn = screen.getByTestId('agent-canvas-toggle-btn');
            fireEvent.click(sidebarBtn);
            expect(toggleCanvas).toHaveBeenCalledTimes(2);
        });
    });

    describe('CanvasModePicker Toggle Buttons', () => {
        it('dispatches viewMode and generationMode changes when clicking Image Studio and Video Studio buttons', () => {
            const setViewMode = vi.fn((mode: 'canvas' | 'release' | 'editor' | 'direct' | 'gallery' | 'video_production' | 'showroom' | 'lab' | 'omni') => {
                useStore.setState({ viewMode: mode });
            });
            const setGenerationMode = vi.fn((gen: 'image' | 'video') => {
                useStore.setState({ generationMode: gen });
            });

            useStore.setState({
                viewMode: 'canvas',
                generationMode: 'image',
                setViewMode,
                setGenerationMode,
            });

            render(<CanvasModePicker />);

            const imageStudioBtn = screen.getByTestId('canvas-mode-canvas');
            const videoStudioBtn = screen.getByTestId('canvas-mode-video_production');

            expect(imageStudioBtn).toBeInTheDocument();
            expect(videoStudioBtn).toBeInTheDocument();

            fireEvent.click(videoStudioBtn);
            expect(setViewMode).toHaveBeenCalledWith('video_production');
            expect(setGenerationMode).toHaveBeenCalledWith('video');
            expect(useStore.getState().viewMode).toBe('video_production');
            expect(useStore.getState().generationMode).toBe('video');

            fireEvent.click(imageStudioBtn);
            expect(setViewMode).toHaveBeenCalledWith('canvas');
            expect(setGenerationMode).toHaveBeenCalledWith('image');
            expect(useStore.getState().viewMode).toBe('canvas');
            expect(useStore.getState().generationMode).toBe('image');
        });
    });

    describe('MarketingToolbar Action Button', () => {
        it('executes primary onAction callback and handles search input modifications', () => {
            const handleAction = vi.fn();
            const handleSearch = vi.fn();

            render(
                <MarketingToolbar
                    title="Campaigns"
                    onAction={handleAction}
                    actionLabel="Create Campaign"
                    searchValue=""
                    onSearchChange={handleSearch}
                />
            );

            const actionBtn = screen.getByRole('button', { name: /create campaign/i });
            fireEvent.click(actionBtn);
            expect(handleAction).toHaveBeenCalledTimes(1);

            const searchInput = screen.getByLabelText(/search campaigns/i);
            fireEvent.change(searchInput, { target: { value: 'Summer Tour' } });
            expect(handleSearch).toHaveBeenCalledWith('Summer Tour');
        });
    });

    describe('CanvasEditor Sub-component Buttons', () => {
        it('ExportBar dispatches onExport callback with active format and scale', () => {
            const onExport = vi.fn();
            render(<ExportBar onExport={onExport} />);

            const formatSelect = screen.getByTestId('export-format');
            const scaleSelect = screen.getByTestId('export-scale');
            const exportBtn = screen.getByTestId('canvas-export');

            fireEvent.change(formatSelect, { target: { value: 'jpeg' } });
            fireEvent.change(scaleSelect, { target: { value: 1 } });
            fireEvent.click(exportBtn);

            expect(onExport).toHaveBeenCalledWith('jpeg', 1);
        });

        it('LayerList invokes visibility, lock, and selection callbacks', () => {
            const onSelect = vi.fn();
            const onToggleVisible = vi.fn();
            const onToggleLock = vi.fn();

            const mockLayers: RasterLayer[] = [
                {
                    id: 'layer-1',
                    name: 'Background Artwork',
                    kind: 'raster',
                    blendMode: 'normal',
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    src: 'https://example.com/art.png',
                    adjustments: {
                        brightness: 0,
                        contrast: 0,
                        saturation: 0,
                        hue: 0,
                        temperature: 0,
                        exposure: 0,
                        blur: 0,
                        vignette: 0,
                    }
                }
            ];

            render(
                <LayerList
                    layers={mockLayers}
                    selectedLayerId="layer-1"
                    onSelect={onSelect}
                    onToggleVisible={onToggleVisible}
                    onToggleLock={onToggleLock}
                />
            );

            const layerRow = screen.getByTestId('layer-row-layer-1');
            fireEvent.click(layerRow);
            expect(onSelect).toHaveBeenCalledWith('layer-1');

            const visibilityBtn = screen.getByTestId('layer-visibility-layer-1');
            fireEvent.click(visibilityBtn);
            expect(onToggleVisible).toHaveBeenCalledWith('layer-1');

            const lockBtn = screen.getByTestId('layer-lock-layer-1');
            fireEvent.click(lockBtn);
            expect(onToggleLock).toHaveBeenCalledWith('layer-1');
        });
    });

    describe('Sidebar and Global Shell Navigation Buttons', () => {
        it('dispatches throttledSetModule and updates module state on nav button click with debounce compliance', async () => {
            const setModule = vi.fn(async (mod: ModuleId) => {
                useStore.setState({ currentModule: mod });
            });
            const toggleSidebar = vi.fn();
            const setConversationMode = vi.fn();

            useStore.setState({
                currentModule: 'dashboard',
                setModule,
                isSidebarOpen: true,
                toggleSidebar,
                conversationMode: 'department',
                setConversationMode,
                projects: [],
            });

            const Sidebar = (await import('@/core/components/Sidebar')).default;
            render(<Sidebar />);

            const returnHqBtn = screen.getByTestId('return-hq-btn');
            expect(returnHqBtn).toBeInTheDocument();
            fireEvent.click(returnHqBtn);
            expect(setModule).toHaveBeenCalledWith('dashboard');

            const sidebarToggle = screen.getByTestId('sidebar-toggle');
            fireEvent.click(sidebarToggle);
            expect(toggleSidebar).toHaveBeenCalledTimes(1);

            // Wait 200ms to clear the 150ms debounce window
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 200));
            });

            const creativeNavBtn = screen.getByTestId('nav-item-creative');
            fireEvent.click(creativeNavBtn);
            expect(setModule).toHaveBeenCalledWith('creative');
        });
    });
});
