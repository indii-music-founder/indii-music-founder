'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Sphere, Instance, Instances } from '@react-three/drei';

const NeuralNetworkMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#b026ff') },
        uColor2: { value: new THREE.Color('#00f3ff') },
        uMouse: { value: new THREE.Vector3(0, 0, 0) },
        uIntensity: { value: 1.0 }
    },
    vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPos;
    uniform float uTime;
    uniform vec3 uMouse;
    
    // Simplex noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) { 
        const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i); 
        vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                      dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      vUv = uv;
      vNormal = normal;
      vPos = position;
      
      // Dynamic noise based on time
      float noise = snoise(position * 1.5 + uTime * 0.3);
      float noise2 = snoise(position * 3.0 - uTime * 0.5);
      
      // Mouse interaction displacement
      float dist = distance(position, uMouse);
      float mouseInfluence = smoothstep(2.0, 0.0, dist) * 0.2;
      
      // Combine displacements
      float displacement = (noise * 0.3 + noise2 * 0.1) + mouseInfluence;
      vec3 pos = position + normal * displacement;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPos;
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uColor2;
    uniform float uIntensity;
    
    void main() {
      // Fresnel
      vec3 viewDirection = normalize(cameraPosition - vPos);
      float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.5);
      
      // Dynamic grid pattern
      float gridX = step(0.97, fract(vUv.x * 30.0 + sin(uTime * 0.5 + vUv.y * 10.0) * 0.1));
      float gridY = step(0.97, fract(vUv.y * 30.0 + cos(uTime * 0.3 + vUv.x * 10.0) * 0.1));
      float grid = max(gridX, gridY);
      
      // Color mixing
      vec3 color = mix(uColor, uColor2, sin(uTime + vPos.y + vPos.x) * 0.5 + 0.5);
      
      // Add "data flow" pulses
      float pulse = step(0.9, sin(vUv.y * 50.0 - uTime * 5.0));
      color += pulse * vec3(0.5);
      
      // Final composition
      float alpha = (fresnel * 0.6 + grid * 0.8 + pulse * 0.2) * uIntensity;
      
      gl_FragColor = vec4(color + vec3(grid), alpha);
    }
  `
};

function NeuralSphere() {
    const mesh = useRef<THREE.Mesh>(null!);
    const materialRef = useRef<THREE.ShaderMaterial>(null!);
    const { mouse, viewport } = useThree();

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();

            // Map mouse to 3D space (approximate)
            const mouseX = (mouse.x * viewport.width) / 2;
            const mouseY = (mouse.y * viewport.height) / 2;

            // Smoothly interpolate mouse uniform
            materialRef.current.uniforms.uMouse.value.lerp(
                new THREE.Vector3(mouseX, mouseY, 2),
                0.1
            );
        }

        // Base rotation
        mesh.current.rotation.y = state.clock.getElapsedTime() * 0.15;
        mesh.current.rotation.z = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.1;
    });

    return (
        <Sphere ref={mesh} args={[2, 128, 128]}>
            <shaderMaterial
                ref={materialRef}
                args={[NeuralNetworkMaterial]}
                transparent
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </Sphere>
    );
}

function NodeParticles() {
    const count = 200;
    const mesh = useRef<THREE.InstancedMesh>(null!);

    // Generate random positions on a sphere surface
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;

            const r = 2.2; // Slightly larger than the main sphere
            const x = r * Math.cos(theta) * Math.sin(phi);
            const y = r * Math.sin(theta) * Math.sin(phi);
            const z = r * Math.cos(phi);

            temp.push({ position: [x, y, z], scale: Math.random() * 0.5 + 0.5 });
        }
        return temp;
    }, []);

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        mesh.current.rotation.y = -time * 0.05; // Counter-rotate

        // Pulse scales
        for (let i = 0; i < count; i++) {
            const scale = particles[i].scale * (1 + Math.sin(time * 2 + i) * 0.3);
            const dummy = new THREE.Object3D();
            dummy.position.set(
                particles[i].position[0],
                particles[i].position[1],
                particles[i].position[2]
            );
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        }
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <Instances range={count} ref={mesh}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshBasicMaterial color="#00f3ff" transparent opacity={0.6} />
            {particles.map((data, i) => (
                <Instance key={i} position={data.position as [number, number, number]} />
            ))}
        </Instances>
    );
}

export default function Hero() {
    return (
        <group position={[0, 0, 0]}>
            <ambientLight intensity={0.5} />
            <NeuralSphere />
            <NodeParticles />

            {/* Background floating particles */}
            <points>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={300}
                        array={new Float32Array(900).map(() => (Math.random() - 0.5) * 15)}
                        itemSize={3}
                        args={[new Float32Array(900).map(() => (Math.random() - 0.5) * 15), 3]}
                    />
                </bufferGeometry>
                <pointsMaterial size={0.03} color="#ffffff" transparent opacity={0.3} sizeAttenuation={true} />
            </points>
        </group>
    );
}
