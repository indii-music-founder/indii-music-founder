'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

// Simple placeholder shader material
const LiquidFabricMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#b026ff') }
    },
    vertexShader: `
    varying vec2 vUv;
    varying float vElevation;
    uniform float uTime;
    
    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Liquid displacement
      float elevation = sin(pos.x * 10.0 + uTime) * sin(pos.y * 10.0 + uTime) * 0.1;
      pos += normal * elevation;
      vElevation = elevation;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    fragmentShader: `
    varying vec2 vUv;
    varying float vElevation;
    uniform vec3 uColor;
    
    void main() {
      float alpha = 0.8 + vElevation * 2.0;
      gl_FragColor = vec4(uColor * alpha, 1.0);
    }
  `
};

function GhostMannequin() {
    const mesh = useRef<THREE.Mesh>(null!);
    const materialRef = useRef<THREE.ShaderMaterial>(null!);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
        }
        mesh.current.rotation.y = state.clock.getElapsedTime() * 0.2;
    });

    return (
        <mesh ref={mesh} position={[0, 0, 0]}>
            {/* Placeholder geometry for a hoodie/torso */}
            <cylinderGeometry args={[0.5, 0.5, 1.5, 32]} />
            {/* Since torsoGeometry doesn't exist in standard three, using a cylinder/capsule approximation or standard geometry */}
            {/* <capsuleGeometry args={[1, 2, 4, 8]} /> */}
            <shaderMaterial
                ref={materialRef}
                args={[LiquidFabricMaterial]}
                transparent
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

export default function Commerce() {
    return (
        <section className="h-screen w-full relative bg-obsidian flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
                <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                    <GhostMannequin />
                </Canvas>
            </div>

            <div className="z-10 text-center pointer-events-none">
                <h2 className="text-6xl md:text-8xl font-bold text-white mb-4 mix-blend-difference">
                    The Infinite Showroom
                </h2>
                <p className="text-xl text-white/70 max-w-xl mx-auto">
                    Liquid Art splashes onto the physical world. Instant merch generation from your sonic identity.
                </p>
            </div>
        </section>
    );
}
