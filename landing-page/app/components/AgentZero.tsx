'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Icosahedron, Octahedron, Trail } from '@react-three/drei';

const GlitchMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#b026ff') }
    },
    vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    uniform float uTime;
    
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vUv = uv;
      vNormal = normal;
      vec3 pos = position;
      
      // Glitch displacement
      float glitch = step(0.95, random(vec2(uTime * 10.0, pos.y)));
      pos.x += glitch * 0.1;
      pos.z += glitch * 0.1;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    uniform vec3 uColor;
    
    void main() {
      float fresnel = pow(1.0 - dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 2.0);
      gl_FragColor = vec4(uColor + fresnel, 1.0);
    }
  `
};

function AgentEntities() {
    const architectRef = useRef<THREE.Mesh>(null!);
    const builderRef = useRef<THREE.Mesh>(null!);
    const materialRef = useRef<THREE.ShaderMaterial>(null!);

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

        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = time;
        }
    });

    return (
        <>
            {/* The Architect (Curriculum Agent) */}
            <Icosahedron ref={architectRef} args={[1, 0]} position={[0, 0, 0]}>
                <shaderMaterial
                    ref={materialRef}
                    args={[GlitchMaterial]}
                    wireframe
                />
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
        <group position={[0, -20, 0]}>
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <AgentEntities />
        </group>
    );
}
