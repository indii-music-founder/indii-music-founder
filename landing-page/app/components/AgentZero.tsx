'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Icosahedron, Octahedron, Trail } from '@react-three/drei';

function AgentEntities() {
    const architectRef = useRef<THREE.Mesh>(null!);
    const builderRef = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Architect: Slow, structured orbit
        architectRef.current.position.x = Math.sin(time * 0.5) * 2;
        architectRef.current.position.y = Math.cos(time * 0.5) * 1;
        architectRef.current.rotation.x = time * 0.2;
        architectRef.current.rotation.y = time * 0.2;

        // Builder: Fast, chaotic orbit around Architect
        builderRef.current.position.x = architectRef.current.position.x + Math.sin(time * 3) * 1.5;
        builderRef.current.position.y = architectRef.current.position.y + Math.cos(time * 3) * 1.5;
        builderRef.current.position.z = Math.sin(time * 4) * 1;
        builderRef.current.rotation.z = time * 5;
    });

    return (
        <>
            {/* The Architect (Curriculum Agent) */}
            <Icosahedron ref={architectRef} args={[1, 0]} position={[0, 0, 0]}>
                <meshStandardMaterial color="#b026ff" wireframe />
            </Icosahedron>

            {/* The Builder (Executor Agent) */}
            <Trail width={0.2} length={8} color={new THREE.Color("#00f3ff")} attenuation={(t) => t * t}>
                <Octahedron ref={builderRef} args={[0.3, 0]} position={[2, 0, 0]}>
                    <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={2} />
                </Octahedron>
            </Trail>
        </>
    );
}

export default function AgentZero() {
    return (
        <section className="h-screen w-full relative bg-obsidian flex flex-row-reverse items-center justify-between overflow-hidden px-8 md:px-20">
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
                    <ambientLight intensity={0.2} />
                    <pointLight position={[10, 10, 10]} intensity={1} />
                    <AgentEntities />
                </Canvas>
            </div>

            <div className="z-10 w-full md:w-1/2 text-right pointer-events-none">
                <h2 className="text-5xl md:text-7xl font-bold mb-6 text-white">
                    Agent R <span className="text-neon-purple text-3xl block mt-2">Powered by Agent0</span>
                </h2>
                <p className="text-xl md:text-2xl text-white/70 font-light mb-8">
                    Symbiotic Co-Evolution. Not just a bot—a manager that writes its own curriculum based on your career’s unique data.
                </p>

                <div className="flex flex-col gap-4 items-end">
                    <div className="flex items-center gap-4">
                        <span className="text-neon-purple font-bold">THE ARCHITECT</span>
                        <div className="w-12 h-1 bg-neon-purple/50 rounded-full"></div>
                    </div>
                    <p className="text-sm text-white/50 max-w-xs">
                        Formulates strategy and "Frontier Tasks" to push your limits.
                    </p>

                    <div className="flex items-center gap-4 mt-4">
                        <span className="text-neon-blue font-bold">THE BUILDER</span>
                        <div className="w-12 h-1 bg-neon-blue/50 rounded-full"></div>
                    </div>
                    <p className="text-sm text-white/50 max-w-xs">
                        Ruthlessly executes code and tools to build the vision.
                    </p>
                </div>
            </div>
        </section>
    );
}
