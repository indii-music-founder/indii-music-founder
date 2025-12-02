'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Trail } from '@react-three/drei';

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

function OrigamiShard({ position, rotation, scale, speed }: { position: [number, number, number], rotation: [number, number, number], scale: number, speed: number }) {
    const mesh = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        mesh.current.rotation.x = rotation[0] + t * speed;
        mesh.current.rotation.y = rotation[1] + t * speed * 0.5;
        mesh.current.position.y = position[1] + Math.sin(t * 2 + position[0]) * 0.2; // Float
    });

    return (
        <mesh ref={mesh} position={position} scale={scale}>
            <icosahedronGeometry args={[1, 0]} /> {/* Detail 0 = 20 triangles, sharp */}
            <meshPhysicalMaterial
                roughness={0.1}
                metalness={0.1}
                transmission={0.95}
                thickness={2.0}
                ior={1.5}
                clearcoat={1}
                attenuationDistance={1.0}
                attenuationColor="#ffffff"
                color="#ffffff"
                iridescence={1}
                iridescenceIOR={1.3}
                dispersion={5}
                flatShading={true} // Enhances the origami/faceted look
            />
        </mesh>
    );
}

function AgentEntities() {
    return (
        <group>
            {/* Central "indii" Intelligence */}
            <OrigamiShard position={[0, 0, 0]} rotation={[0, 0, 0]} scale={2} speed={0.2} />

            {/* Orbiting Shards */}
            <OrigamiShard position={[3, 2, -2]} rotation={[1, 2, 0]} scale={0.8} speed={0.3} />
            <OrigamiShard position={[-3, -1, 1]} rotation={[2, 1, 1]} scale={0.6} speed={0.4} />
            <OrigamiShard position={[1, -3, -1]} rotation={[0, 3, 2]} scale={0.5} speed={0.25} />

            {/* Connecting Lines (Constellation effect) */}
            {/* We could add lines connecting them if desired, but floating shards fits "origami" well */}
        </group>
    );
}

export default function AgentZero() {
    return (
        <group position={[0, -32, 0]}>
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <AgentEntities />
        </group>
    );
}
