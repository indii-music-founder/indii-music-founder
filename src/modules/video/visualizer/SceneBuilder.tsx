import React, { useState, useRef, useMemo, useEffect, Suspense, Component, ErrorInfo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, useGLTF } from '@react-three/drei';
import { Mesh } from 'three'; // Item 357: Named import enables Three.js tree-shaking
import { Download, Trash2, BoxSelect, MonitorPlay } from 'lucide-react';

/**
 * Advanced 3D Scene Builder component implementing requirement 105.
 * Allows users to drop 3D assets to build custom music video sets using @react-three/fiber.
 */

interface DroppedAsset {
    id: string;
    url: string;
    position: [number, number, number];
    scale: number;
}

// Error boundary so a bad GLTF file doesn't crash the whole canvas
class ModelErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(_: Error) { return { hasError: true }; }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Failed to load GLTF model:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) return null;
        return this.props.children;
    }
}

// useGLTF must be called unconditionally (rules-of-hooks). Suspense + ModelErrorBoundary handle failures.
const Model = ({ url, position, scale }: { url: string; position: [number, number, number]; scale: number }) => {
    const { scene } = useGLTF(url);

    // Clone once per scene reference — not on every render
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    // Dispose all GPU resources when this model unmounts
    useEffect(() => {
        return () => {
            clonedScene.traverse((obj) => {
                if (obj instanceof Mesh) {
                    obj.geometry?.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material?.dispose();
                    }
                }
            });
        };
    }, [clonedScene]);

    return <primitive object={clonedScene} position={position} scale={scale} />;
};

const DroppableArea = ({ onDrop }: { onDrop: (url: string) => void }) => {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
                const url = URL.createObjectURL(file);
                onDrop(url);
            } else {
                alert('Please drop a valid .glb or .gltf 3D model file.');
            }
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center border-4 border-transparent border-dashed hover:border-blue-500/50 transition-colors"
        >
            {/* The invisible dropzone overlay */}
        </div>
    );
};

export const SceneBuilder = () => {
    const [assets, setAssets] = useState<DroppedAsset[]>([]);

    const handleDrop = (url: string) => {
        const newAsset: DroppedAsset = {
            id: Date.now().toString(),
            url,
            // Drop them slightly spread out
            position: [(Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5],
            scale: 1,
        };
        setAssets((prev) => [...prev, newAsset]);
    };

    const handleClear = () => {
        // Revoke blob URLs created by URL.createObjectURL to free browser memory
        assets.forEach(asset => {
            if (asset.url.startsWith('blob:')) {
                URL.revokeObjectURL(asset.url);
            }
        });
        setAssets([]);
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800 relative">

            {/* Toolbar */}
            <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
                <div className="flex items-center gap-3">
                    <BoxSelect className="w-6 h-6 text-blue-400" />
                    <h2 className="text-white font-semibold text-lg">3D Stage Builder</h2>
                    <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded border border-blue-500/30">Beta</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md transition-colors border border-red-500/20"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear Stage
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-md transition-colors font-medium shadow-lg shadow-blue-500/20">
                        <MonitorPlay className="w-4 h-4" />
                        Preview Camera
                    </button>
                </div>
            </div>

            {/* Instruction Overlay when empty */}
            {assets.length === 0 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
                    <div className="bg-gray-900/80 p-8 rounded-2xl border border-gray-700/50 backdrop-blur-md flex flex-col items-center text-center max-w-md">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                            <Download className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-medium text-white mb-2">Build Your Set</h3>
                        <p className="text-gray-400 text-sm">
                            Drag and drop any <b>.glb</b> or <b>.gltf</b> 3D assets into the viewer to populate your custom music video stage.
                        </p>
                    </div>
                </div>
            )}

            {/* Drag & Drop Overlay */}
            <DroppableArea onDrop={handleDrop} />

            {/* 3D Canvas */}
            <div className="w-full h-[600px] bg-black">
                <Canvas shadows camera={{ position: [0, 2, 8], fov: 45 }}>
                    <color attach="background" args={['#050505']} />

                    {/* Lighting setup for stage-like appearance */}
                    <ambientLight intensity={0.2} />
                    <spotLight position={[0, 10, 0]} intensity={2} penumbra={1} angle={0.5} castShadow />
                    <directionalLight position={[-5, 5, 5]} intensity={0.5} castShadow />
                    <directionalLight position={[5, 5, -5]} intensity={0.5} color="#3b82f6" />

                    <Suspense fallback={null}>
                        {/* Render all dropped assets */}
                        {assets.map((asset) => (
                            <ModelErrorBoundary key={asset.id}>
                                <Model url={asset.url} position={asset.position} scale={asset.scale} />
                            </ModelErrorBoundary>
                        ))}

                        {/* Environment & Shadows */}
                        <Environment preset="night" />
                        <ContactShadows position={[0, -0.01, 0]} resolution={512} scale={20} blur={2} opacity={0.6} />
                    </Suspense>

                    {/* Stage Floor */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[100, 100]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.8} />
                    </mesh>

                    {/* Grid helper for scale reference */}
                    <gridHelper args={[20, 20, '#333333', '#222222']} position={[0, 0.01, 0]} />

                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.05} />
                </Canvas>
            </div>
        </div>
    );
};
