'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useAudioStore } from '../store/audioStore';

const BAND_COUNT = 31;

export default function AudioRing() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const freqDataRef = useRef<number[]>(new Array(BAND_COUNT).fill(0));

    // Subscribe to audio store to get bands directly without re-rendering component
    useEffect(() => {
        return useAudioStore.subscribe((state) => {
            freqDataRef.current = state.frequencyData.bands;
        });
    }, []);

    const particles = useMemo(() => {
        const temp = [];
        const radius = 3.5; // Radius of the ring

        for (let i = 0; i < BAND_COUNT; i++) {
            const angle = (i / BAND_COUNT) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Create a rotation quaternion to face outward/upward
            const rotation = new THREE.Euler(0, -angle, 0);
            const quaternion = new THREE.Quaternion().setFromEuler(rotation);

            temp.push({
                position: new THREE.Vector3(x, 0, z),
                rotation: quaternion,
                baseScale: new THREE.Vector3(0.1, 0.5, 0.1), // Thin bars
                color: new THREE.Color().setHSL(i / BAND_COUNT, 0.8, 0.5) // Rainbow spectrum
            });
        }
        return temp;
    }, []);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        const bands = freqDataRef.current;
        const time = state.clock.elapsedTime;

        // Rotate the entire ring slowly
        if (meshRef.current) {
            meshRef.current.rotation.y = time * 0.1;
        }

        particles.forEach((particle, i) => {
            const bandValue = bands[i] || 0;

            // Scale height based on band value
            // Add a minimum height so they don't disappear
            const heightScale = 1 + bandValue * 10;

            dummy.position.copy(particle.position);
            dummy.quaternion.copy(particle.rotation);

            // Scale: X (width), Y (height), Z (depth)
            dummy.scale.set(
                1,
                heightScale,
                1
            );

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // Dynamic color brightness based on intensity
            const intensity = 0.5 + bandValue * 2; // Boost brightness on beat
            const color = particle.color.clone().multiplyScalar(intensity);
            meshRef.current.setColorAt(i, color);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <group>
            <Environment preset="city" />
            <Instances range={BAND_COUNT} ref={meshRef}>
                <boxGeometry args={[0.15, 0.5, 0.15]} /> {/* Base size of bars */}
                <meshPhysicalMaterial
                    roughness={0.1}
                    metalness={0.8}
                    transmission={0.2} // Slight glass effect
                    thickness={1.0}
                    ior={1.5}
                    clearcoat={1}
                    clearcoatRoughness={0.1}
                    toneMapped={false}
                    emissive="#ffffff"
                    emissiveIntensity={0.1}
                    color="#ffffff"
                />
                {particles.map((_, i) => (
                    <Instance key={i} />
                ))}
            </Instances>
        </group>
    );
}
