'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Trail, TorusKnot } from '@react-three/drei';

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

function OrbitalPath() {
    const orbiterRef = useRef<THREE.Mesh>(null!);

    // Create a complex 3D curve "back to front, around and over"
    const curve = useMemo(() => {
        return new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, -4),   // Back
            new THREE.Vector3(3, 2, 0),    // Right Up
            new THREE.Vector3(0, 4, 2),    // Top Front
            new THREE.Vector3(-3, 0, 0),   // Left
            new THREE.Vector3(0, -3, -2),  // Bottom Back
            new THREE.Vector3(4, 0, 2),    // Right Front
            new THREE.Vector3(0, 0, -4)    // Back (Loop)
        ], true, 'catmullrom', 0.5);
    }, []);

    useFrame((state) => {
        const t = (state.clock.getElapsedTime() * 0.2) % 1; // 5 seconds per loop
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);

        orbiterRef.current.position.copy(point);
        orbiterRef.current.lookAt(point.clone().add(tangent));
    });

    return (
        <group>
            {/* Visualize Path (Optional, faint) */}
            <line>
                <bufferGeometry setFromPoints={curve.getPoints(100)} />
                <lineBasicMaterial color="#444" transparent opacity={0.2} />
            </line>

            {/* Orbiter with Trail */}
            <Trail width={0.4} length={12} color={new THREE.Color("#00f3ff")} attenuation={(t) => t * t}>
                <mesh ref={orbiterRef}>
                    <sphereGeometry args={[0.15, 16, 16]} />
                    <meshBasicMaterial color="#00f3ff" toneMapped={false} />
                </mesh>
            </Trail>
        </group>
    );
}

function AgentEntities() {
    const knotRef = useRef<THREE.Mesh>(null!);
    const materialRef = useRef<THREE.ShaderMaterial>(null!);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Slow, majestic rotation for the central knot
        knotRef.current.rotation.x = time * 0.1;
        knotRef.current.rotation.y = time * 0.15;

        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = time;
        }
    });

    return (
        <>
            {/* The Architect (Central Knot) */}
            <TorusKnot ref={knotRef} args={[1.5, 0.4, 128, 32]} position={[0, 0, 0]}>
                <shaderMaterial
                    ref={materialRef}
                    args={[GlitchMaterial]}
                    wireframe
                />
            </TorusKnot>

            {/* The Builder (Orbital Flow) */}
            <OrbitalPath />
        </>
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
