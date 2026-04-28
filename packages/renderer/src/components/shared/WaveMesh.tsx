import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import { useStore } from '@/core/store';

// Custom Shader Material
const WaveShaderMaterial = shaderMaterial(
    // Uniforms
    {
        uTime: 0,
        uColorStart: new THREE.Color('#050a05') as any, // Dark Green Base
        uColorEnd: new THREE.Color('#0a1a0a') as any,   // Forest Green
        uMouse: new THREE.Vector2(0, 0) as any,
        uHover: 0,
        uAudioEQ: new THREE.Vector4(0, 0, 0, 0) as any,
        // Brand Colors / Frequency Colors
        uColorBass: new THREE.Color('#00ff66') as any,    // Spring Green
        uColorLowMid: new THREE.Color('#bfff00') as any,  // Lime
        uColorHighMid: new THREE.Color('#10b981') as any, // Emerald
        uColorTreble: new THREE.Color('#ffffff') as any,  // White Sparkle
    },
    // Vertex Shader
    `
    varying vec2 vUv;
    varying float vElevation;
    varying vec4 vAudio;
    varying float vDisplacement;
    
    uniform float uTime;
    uniform vec4 uAudioEQ;

    // Simplex noise function (simplified)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                            0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                            -0.577350269189626, // -1.0 + 2.0 * C.x
                            0.024390243902439); // 1.0 / 41.0
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i); // Avoid truncation effects in permutation
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
      vUv = uv;
      vAudio = uAudioEQ;
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);

      // Distance from center
      float dist = length(modelPosition.xz);
      float angle = atan(modelPosition.z, modelPosition.x);

      // --- Band 1: BASS (Deep, slow, central pulse) ---
      float bassDisplacement = sin(dist * 0.5 - uTime * 1.0) * uAudioEQ.x * 2.0;
      float bassKick = smoothstep(10.0, 0.0, dist) * uAudioEQ.x * 2.0;

      // --- Band 2: LOW MID (Rolling waves) ---
      float lowMidDisplacement = sin(modelPosition.x * 0.5 + uTime * 0.5) * uAudioEQ.y * 1.5;

      // --- Band 3: HIGH MID (Interference patterns) ---
      float highMidDisplacement = snoise(modelPosition.xz * 0.2 + uTime * 0.5) * uAudioEQ.z * 1.5;

      // --- Band 4: TREBLE (Sharp, jagged noise) ---
      float trebleDisplacement = snoise(modelPosition.xz * 1.0 - uTime) * uAudioEQ.w * 0.8;

      // Combine displacements
      float totalDisplacement = bassDisplacement + bassKick + lowMidDisplacement + highMidDisplacement + trebleDisplacement;
      
      // Add subtle base breathing
      totalDisplacement += sin(modelPosition.x * 1.0 + uTime * 0.2) * 0.2;

      modelPosition.y += totalDisplacement;
      vElevation = totalDisplacement;
      vDisplacement = totalDisplacement;

      gl_Position = projectionMatrix * viewMatrix * modelPosition;
    }
  `,
    // Fragment Shader
    `
    varying vec2 vUv;
    varying float vElevation;
    varying vec4 vAudio;
    varying float vDisplacement;
    
    uniform vec3 uColorStart;
    uniform vec3 uColorEnd;
    uniform vec3 uColorBass;
    uniform vec3 uColorLowMid;
    uniform vec3 uColorHighMid;
    uniform vec3 uColorTreble;

    void main() {
      float mixStrength = (vElevation + 1.0) * 0.25; 
      vec3 color = mix(uColorStart, uColorEnd, mixStrength);

      // --- AUDIO COLOR MIXING ---
      color += uColorBass * vAudio.x * 0.8;
      
      float wavePattern = sin(vUv.x * 10.0 + vAudio.y);
      color += uColorLowMid * vAudio.y * 0.6 * smoothstep(0.3, 0.7, wavePattern);

      float ripplePattern = sin(length(vUv - 0.5) * 20.0);
      color += uColorHighMid * vAudio.z * 0.6 * smoothstep(0.3, 0.7, ripplePattern);

      float peak = smoothstep(1.0, 3.5, vElevation);
      color += uColorTreble * vAudio.w * peak * 3.5;

      float vignette = 1.0 - length(vUv - 0.5);
      color *= smoothstep(0.0, 1.5, vignette);

      gl_FragColor = vec4(color, 1.0); 
    }
  `
);

extend({ WaveShaderMaterial });

// Add type definition for the shader material
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
    namespace JSX {
        interface IntrinsicElements {
            waveShaderMaterial: any;
        }
    }
}

export default function WaveMesh() {
    const materialRef = useRef<any>(null);

    // Helper to calculate average of a sub-array
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uTime = state.clock.elapsedTime * 0.4;

            // Get Audio Data from the global store
            const { frequencyData } = useStore.getState();
            const { bands } = frequencyData;

            // Create 4-Band EQ (Bands 0-30)
            const bass = Math.pow(avg(bands.slice(0, 4)), 1.5) * 1.2;
            const lowMid = Math.pow(avg(bands.slice(4, 11)), 1.5) * 1.0;
            const highMid = Math.pow(avg(bands.slice(11, 21)), 1.5) * 1.0;
            const treble = Math.pow(avg(bands.slice(21, 31)), 1.5) * 1.5;

            materialRef.current.uAudioEQ.set(bass, lowMid, highMid, treble);
        }
    });

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} frustumCulled={false}>
            <planeGeometry args={[25, 25, 64, 64]} />
            <waveShaderMaterial
                ref={materialRef}
                uColorStart={new THREE.Color('#050a05') as any}
                uColorEnd={new THREE.Color('#0a1a0a') as any}
                uColorBass={new THREE.Color('#00ff66') as any}   // Spring Green
                uColorLowMid={new THREE.Color('#bfff00') as any} // Lime
                uColorHighMid={new THREE.Color('#10b981') as any} // Emerald
                uColorTreble={new THREE.Color('#ffffff') as any}
                wireframe={true}
                transparent={true}
                opacity={1.0}
            />
        </mesh>
    );
}
