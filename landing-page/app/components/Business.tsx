'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances } from '@react-three/drei';

// --- SHADERS & MATERIALS ---

const planetMaterial = new THREE.MeshBasicMaterial({
    color: '#00ff9d',
    wireframe: true,
    transparent: true,
    opacity: 0.15
});

const coreMaterial = new THREE.MeshBasicMaterial({
    color: '#003311',
    transparent: true,
    opacity: 0.8
});

// --- COMPONENTS ---

function CyberPlanet() {
    const mesh = useRef<THREE.Mesh>(null!);
    const core = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        mesh.current.rotation.y = t * 0.05;
        core.current.rotation.y = t * 0.1;
        core.current.rotation.z = Math.sin(t * 0.2) * 0.1;
    });

    return (
        <group>
            {/* Wireframe Crust */}
            <mesh ref={mesh}>
                <icosahedronGeometry args={[4, 4]} />
                <primitive object={planetMaterial} />
            </mesh>
            {/* Solid Core */}
            <mesh ref={core} scale={0.8}>
                <icosahedronGeometry args={[4, 1]} />
                <primitive object={coreMaterial} />
            </mesh>
        </group>
    );
}

function ShipSwarm({ count, color, radius, speed, type }: { count: number, color: string, radius: number, speed: number, type: 'rebel' | 'empire' }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);

    const ships = useMemo(() => {
        return new Array(count).fill(0).map((_, i) => {
            const angle = (i / count) * Math.PI * 2;
            const yOffset = (Math.random() - 0.5) * 2;
            return {
                angle,
                radius: radius + (Math.random() - 0.5),
                y: yOffset,
                speedOffset: Math.random() * 0.5 + 0.8
            };
        });
    }, [count, radius]);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        ships.forEach((ship, i) => {
            // Orbit logic
            const currentAngle = ship.angle + t * speed * ship.speedOffset;
            const x = Math.cos(currentAngle) * ship.radius;
            const z = Math.sin(currentAngle) * ship.radius;

            dummy.position.set(x, ship.y, z);

            // Face direction of travel
            dummy.lookAt(0, ship.y, 0); // Look at center first
            dummy.rotateY(Math.PI / 2); // Rotate to face tangent

            // Bank on turns
            dummy.rotateZ(Math.sin(t * 2 + i) * 0.2);

            // Scale variation
            const scale = type === 'rebel' ? 0.3 : 0.25;
            dummy.scale.setScalar(scale);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            {type === 'rebel' ? (
                <tetrahedronGeometry args={[1]} /> // Wedge shape
            ) : (
                <octahedronGeometry args={[1]} /> // TIE shape
            )}
            <meshBasicMaterial color={color} toneMapped={false} />
        </Instances>
    );
}

function Lasers() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 20;

    const lasers = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            active: false,
            start: new THREE.Vector3(),
            end: new THREE.Vector3(),
            life: 0
        }));
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        lasers.forEach((laser, i) => {
            if (!laser.active) {
                // Randomly activate
                if (Math.random() > 0.98) {
                    laser.active = true;
                    laser.life = 1.0;

                    // Random positions around the planet
                    const angle1 = Math.random() * Math.PI * 2;
                    const r1 = 6;
                    laser.start.set(Math.cos(angle1) * r1, (Math.random() - 0.5) * 4, Math.sin(angle1) * r1);

                    // Target near opposite side or random
                    const angle2 = angle1 + Math.PI + (Math.random() - 0.5);
                    const r2 = 6;
                    laser.end.set(Math.cos(angle2) * r2, (Math.random() - 0.5) * 4, Math.sin(angle2) * r2);
                }
                // Hide inactive
                dummy.scale.set(0, 0, 0);
            } else {
                laser.life -= 0.1;
                if (laser.life <= 0) laser.active = false;

                // Position laser beam
                const mid = new THREE.Vector3().lerpVectors(laser.start, laser.end, 0.5);
                dummy.position.copy(mid);
                dummy.lookAt(laser.end);

                const len = laser.start.distanceTo(laser.end);
                dummy.scale.set(0.05, 0.05, len); // Thickness, Thickness, Length
            }

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ff0033" toneMapped={false} transparent opacity={0.8} />
        </instancedMesh>
    );
}

function OrbitalDebris() {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const count = 100;

    const debris = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            // Start near bottom of planet
            x: (Math.random() - 0.5) * 8,
            y: -4 + Math.random() * 2,
            z: (Math.random() - 0.5) * 8,
            speed: Math.random() * 0.1 + 0.05,
            rotationSpeed: Math.random() * 0.05,
            scale: Math.random() * 0.3 + 0.1
        }));
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const dummy = new THREE.Object3D();

        debris.forEach((d, i) => {
            // Fall downwards
            let y = d.y - (t * d.speed * 10) % 20; // Loop fall

            // Spiral slightly
            const x = d.x + Math.sin(t * 0.5 + i) * 0.5;
            const z = d.z + Math.cos(t * 0.5 + i) * 0.5;

            dummy.position.set(x, y, z);
            dummy.rotation.set(t * d.rotationSpeed, t * d.rotationSpeed, t * d.rotationSpeed);
            dummy.scale.setScalar(d.scale);

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={meshRef}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#00ff9d" wireframe transparent opacity={0.3} />
            {debris.map((_, i) => (
                <Instance key={i} />
            ))}
        </Instances>
    );
}

export default function Business() {
    return (
        <group position={[0, -60, 0]}>
            <CyberPlanet />

            {/* Rebel Alliance - Orange/Red */}
            <group rotation={[0.2, 0, 0]}>
                <ShipSwarm count={12} color="#ffaa00" radius={6} speed={0.5} type="rebel" />
            </group>

            {/* The Empire - Cyan/Green */}
            <group rotation={[-0.2, Math.PI, 0]}>
                <ShipSwarm count={20} color="#00ff9d" radius={7} speed={-0.4} type="empire" />
            </group>

            <Lasers />

            {/* Debris falling to Commerce */}
            <OrbitalDebris />
        </group>
    );
}
