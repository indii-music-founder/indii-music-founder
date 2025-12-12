'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import { createNoise3D } from 'simplex-noise';

// Custom Shader Material
const WaveShaderMaterial = shaderMaterial(
    // Uniforms
    {
        uTime: 0,
        uColorStart: new THREE.Color('#030303'), // Void
        uColorEnd: new THREE.Color('#2E2EFE'),   // Resonance Blue
        uMouse: new THREE.Vector2(0, 0),
        uHover: 0, // 0 to 1
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    varying float vElevation;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uHover;

    // Simplex noise function (simplified for brevity, often included or imported)
    // For this prototype, we'll use a basic sine composition to simulate pulses
    // In production, we'd inject full simplex noise GLSL code here

    void main() {
      vUv = uv;
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);

      // Create a base pulse (heartbeat)
      float pulse = sin(uTime * 2.0) * 0.1;

      // Create varying elevation based on position and time
      float elevation = sin(modelPosition.x * 3.0 + uTime * 0.5) * 
                        sin(modelPosition.z * 1.5 + uTime * 0.5) * 0.5;

      // Add mouse interaction ripple (distance based)
      // We assume uMouse is in world coords for simplicity or normalized
      // Actually R3F gives normalized mouse (-1 to 1). 
      // Let's assume the mesh is centered.
      
      // Basic wave movement
      modelPosition.y += elevation;
      modelPosition.y += pulse; // The "Subliminal Pulse"

      vElevation = elevation;

      gl_Position = projectionMatrix * viewMatrix * modelPosition;
    }
  `,
    // Fragment Shader
    `
    varying vec2 vUv;
    varying float vElevation;
    uniform vec3 uColorStart;
    uniform vec3 uColorEnd;
    uniform float uHover;

    void main() {
      // Mix colors based on elevation
      float mixStrength = (vElevation + 0.5) * 0.8;
      // Add a "frequency" line effect
      float frequency = mod(vUv.y * 50.0, 1.0);
      float line = step(0.9, frequency) * 0.2; // subtle scanlines

      vec3 color = mix(uColorStart, uColorEnd, mixStrength + (uHover * 0.2));
      
      // Add bioluminescent glow to peaks
      float peak = step(0.4, vElevation);
      color += vec3(0.2, 0.0, 0.4) * peak; // Pinkish hint

      gl_FragColor = vec4(color + line, 1.0);
    }
  `
);

extend({ WaveShaderMaterial });

// Add type definition for the shader material
declare module '@react-three/fiber' {
    interface ThreeElements {
        waveShaderMaterial: {
            ref?: React.Ref<any>;
            uColorStart?: THREE.Color;
            uColorEnd?: THREE.Color;
            uTime?: number;
            uMouse?: THREE.Vector2;
            uHover?: number;
            wireframe?: boolean;
            transparent?: boolean;
            opacity?: number;
            attach?: string;
        }
    }
}

export default function WaveMesh() {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<any>(null);
    const noise3D = useMemo(() => createNoise3D(), []);

    useFrame((state, delta) => {
        if (materialRef.current) {
            materialRef.current.uTime = state.clock.elapsedTime;
            // Smoothly interpolate mouse position if needed
            // materialRef.current.uMouse = state.mouse; 
        }
    });

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
            <planeGeometry args={[20, 20, 128, 128]} />
            <waveShaderMaterial
                ref={materialRef}
                uColorStart={new THREE.Color('#050510')}
                uColorEnd={new THREE.Color('#1a1a40')}
                wireframe={true} // Wireframe gives that "building block of the universe" feel
                transparent={true}
                opacity={0.6}
            />
        </mesh>
    );
}
