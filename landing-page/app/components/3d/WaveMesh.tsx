'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import { createNoise3D } from 'simplex-noise';
import { audioStore } from '../../store/audioStore';

// Custom Shader Material
const WaveShaderMaterial = shaderMaterial(
    // Uniforms
    {
        uTime: 0,
        uColorStart: new THREE.Color('#1a0b2e'), // Deep Purple Base
        uColorEnd: new THREE.Color('#431050'),   // Lighter Violet
        uMouse: new THREE.Vector2(0, 0),
        uHover: 0,
        uAudioEQ: new THREE.Vector4(0, 0, 0, 0), // Bass, LowMid, HighMid, Treble
        // Brand Colors / Frequency Colors
        uColorBass: new THREE.Color('#5000ff'),    // Electric Indigo
        uColorLowMid: new THREE.Color('#00ccff'),  // Cyan
        uColorHighMid: new THREE.Color('#ff0055'), // Magenta
        uColorTreble: new THREE.Color('#ffffff'),  // White Sparkle
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
      // Acts like a heartbeat or subwoofer cone
      float bassDisplacement = sin(dist * 0.5 - uTime * 1.0) * uAudioEQ.x * 2.0;
      float bassKick = smoothstep(10.0, 0.0, dist) * uAudioEQ.x * 2.0;

      // --- Band 2: LOW MID (Rolling waves) ---
      // Moves from front to back - SLOW
      float lowMidDisplacement = sin(modelPosition.x * 0.5 + uTime * 0.5) * uAudioEQ.y * 1.5;

      // --- Band 3: HIGH MID (Interference patterns) ---
      // Creates cross-hatching or more complex ripples
      float highMidDisplacement = snoise(modelPosition.xz * 0.2 + uTime * 0.5) * uAudioEQ.z * 1.5;

      // --- Band 4: TREBLE (Sharp, jagged noise) ---
      float trebleDisplacement = snoise(modelPosition.xz * 1.0 - uTime) * uAudioEQ.w * 0.8;

      // Combine displacements
      // Ideally, the bass is the strongest "shape", others add texture
      float totalDisplacement = bassDisplacement + bassKick + lowMidDisplacement + highMidDisplacement + trebleDisplacement;
      
      // Add subtle base breathing - SLOW OCEAN SWELL
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
      // Base Gradient with deeper void - sharper mix based on elevation
      float mixStrength = (vElevation + 1.0) * 0.25; 
      vec3 color = mix(uColorStart, uColorEnd, mixStrength);

      // --- AUDIO COLOR MIXING ---
      // Additive mixing for neon glow feel
      
      // Bass: Indigo - Boosted INTENSITY
      color += uColorBass * vAudio.x * 0.8;
      
      // LowMid: Cyan
      float wavePattern = sin(vUv.x * 10.0 + vAudio.y);
      color += uColorLowMid * vAudio.y * 0.6 * smoothstep(0.3, 0.7, wavePattern);

      // HighMid: Magenta
      float ripplePattern = sin(length(vUv - 0.5) * 20.0);
      color += uColorHighMid * vAudio.z * 0.6 * smoothstep(0.3, 0.7, ripplePattern);

      // Treble: White sparks
      float peak = smoothstep(1.0, 3.5, vElevation);
      color += uColorTreble * vAudio.w * peak * 3.5;

      // Vignette
      float vignette = 1.0 - length(vUv - 0.5);
      color *= smoothstep(0.0, 1.5, vignette);

      gl_FragColor = vec4(color, 1.0); 
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
            uAudioEQ?: THREE.Vector4;
            uColorBass?: THREE.Color;
            uColorLowMid?: THREE.Color;
            uColorHighMid?: THREE.Color;
            uColorTreble?: THREE.Color;
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

    // Helper to calculate average of a sub-array
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

    useFrame((state, delta) => {
        if (materialRef.current) {
            // Slow down time for massive scale feeling
            materialRef.current.uTime = state.clock.elapsedTime * 0.4;

            // Get Audio Data
            const { frequencyData } = audioStore.getState();
            const { bands } = frequencyData; // 31 Bands

            // Create 4-Band EQ
            // Band 0 (Bass): 0-3
            // Band 1 (LowMid): 4-10
            // Band 2 (HighMid): 11-20
            // Band 3 (Treble): 21-30

            // Apply non-linear styling (Math.pow) to suppress noise and prevent "wash out" on mastered tracks.
            // This emphasizes peaks while keeping the average level controlled.
            const bass = Math.pow(avg(bands.slice(0, 4)), 1.5) * 1.2;     // Solid beat, no overwhelming flood
            const lowMid = Math.pow(avg(bands.slice(4, 11)), 1.5) * 1.0;  // Body of the music
            const highMid = Math.pow(avg(bands.slice(11, 21)), 1.5) * 1.0; // Textural details
            const treble = Math.pow(avg(bands.slice(21, 31)), 1.5) * 1.5; // Sparkles only on real hits

            // Damping/Smoothing could be added here if needed, but framerate is usually high enough

            materialRef.current.uAudioEQ.set(bass, lowMid, highMid, treble);
        }
    });

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} frustumCulled={false}>
            <planeGeometry args={[25, 25, 64, 64]} />
            {/* 
                WAVE SHADER CONFIGURATION
                -------------------------
                uColorStart/End: Controls the gradient background. 
                                 Keep Start near-black (#000000) for the "Void" look.
                uColor[Band]: Controls the color of the wireframe for each audio frequency.
                opacity: Controls how visible the wireframe is in its resting state (1.0 = fully visible).
                uTime multiplier (in useFrame): Controls the speed of the wave.
            */}
            <waveShaderMaterial
                ref={materialRef}
                uColorStart={new THREE.Color('#080808')}
                uColorEnd={new THREE.Color('#201030')}
                uColorBass={new THREE.Color('#4d21fc')}   // Electric Indigo
                uColorLowMid={new THREE.Color('#00d4ff')} // Bright Cyan
                uColorHighMid={new THREE.Color('#ff006a')} // Bright Magenta
                uColorTreble={new THREE.Color('#ffffff')}
                wireframe={true}
                transparent={true}
                opacity={1.0}
            />
        </mesh>
    );
}
