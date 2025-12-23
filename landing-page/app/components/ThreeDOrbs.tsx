'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { useAudioStore } from '../store/audioStore';

const COUNT = 15;

export default function ThreeDOrbs() {
    const { viewport, camera } = useThree();
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const noise2D = useMemo(() => createNoise2D(), []);

    // Subscribe to audio store
    const freqDataRef = useRef({ bass: 0, mid: 0, high: 0 });
    useEffect(() => {
        return useAudioStore.subscribe((state) => {
            freqDataRef.current = state.frequencyData;
        });
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < COUNT; i++) {
            const scale = Math.random() * 0.5 + 0.2; // Base size
            temp.push({
                // Start at random x, well below the view in y, random z depth
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * viewport.width * 1.5,
                    -viewport.height / 2 - Math.random() * 10,
                    (Math.random() - 0.5) * 5 // Depth
                ),
                scale,
                baseScale: scale,
                speed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * 1000,
                color: new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 0.8, 0.5) // Cyan to Purple
            });
        }
        return temp;
    }, [viewport]);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    useFrame((state, delta) => {
        const { bass, mid, high } = freqDataRef.current;
        const time = state.clock.elapsedTime;
        const cameraY = camera.position.y;

        particles.forEach((particle, i) => {
            // 1. Update Position
            // Float up
            particle.position.y += particle.speed * (1 + high * 2);

            // Noise movement
            const nX = noise2D(particle.offset + time * 0.1, 0);
            const nZ = noise2D(0, particle.offset + time * 0.1);

            particle.position.x += nX * 0.01;
            particle.position.z += nZ * 0.01;

            // Wrap around logic relative to camera
            const topBound = cameraY + viewport.height / 2 + 2;
            const bottomBound = cameraY - viewport.height / 2 - 5;

            if (particle.position.y > topBound) {
                particle.position.y = bottomBound;
                particle.position.x = (Math.random() - 0.5) * viewport.width * 1.5;
            }
            if (particle.position.y < bottomBound - 10) {
                particle.position.y = bottomBound;
            }

            // 2. Audio Reactivity
            // Scale pulse with bass
            const targetScale = particle.baseScale * (1 + bass * 0.5);
            particle.scale = THREE.MathUtils.lerp(particle.scale, targetScale, 0.1);

            // 3. Update Matrix
            dummy.position.copy(particle.position);
            dummy.scale.setScalar(particle.scale);
            dummy.rotation.x += 0.01;
            dummy.rotation.y += 0.01;
            dummy.updateMatrix();

            meshRef.current.setMatrixAt(i, dummy.matrix);

            // 4. Update Color
            // We use standard white for glass, but maybe slight emissive tint?
            // Actually for physically correct glass, we don't want to mess with vertex colors too much 
            // if we want pure refraction. But let's keep it simple.
            // meshRef.current.setColorAt(i, color); // disable color updates for pure glass
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <group>
            <Environment preset="city" />
            <Instances range={COUNT} ref={meshRef}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshPhysicalMaterial
                    roughness={0.02} // Ultra smooth
                    metalness={0.1} // Less metallic, more glass-like
                    transmission={0.98} // Crystal clear
                    thickness={2.0}
                    ior={1.45} // Acrylic/Glass
                    clearcoat={1}
                    clearcoatRoughness={0.02}
                    attenuationDistance={2.0}
                    attenuationColor="#ffffff"
                    color="#ffffff"
                    iridescence={0.5} // Subtle iridescence
                    iridescenceIOR={1.3}
                    iridescenceThicknessRange={[0, 400]}
                    dispersion={4} // Subtle dispersion
                />
                {particles.map((_, i) => (
                    <Instance key={i} />
                ))}
            </Instances>
        </group>
    );
}
