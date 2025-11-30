'use client';

import { useFrame } from '@react-three/fiber';
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

function LiquidMetalMannequin() {
    const mesh = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        mesh.current.rotation.y = state.clock.getElapsedTime() * 0.2;
    });

    return (
        <mesh ref={mesh} position={[0, 0, 0]}>
            <torusKnotGeometry args={[1, 0.3, 128, 32]} />
            <meshPhysicalMaterial
                color="#ffffff"
                metalness={1}
                roughness={0}
                clearcoat={1}
                clearcoatRoughness={0}
                transmission={0} // Opaque liquid metal
                reflectivity={1}
                emissive="#b026ff"
                emissiveIntensity={0.2}
            />
        </mesh>
    );
}

export default function Commerce() {
    return (
        <group position={[0, -40, 0]}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <LiquidMetalMannequin />
        </group>
    );
}
