

import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { audioStore } from '../store/audioStore';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

function ReactiveBloom() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ref = useRef<any>(null);

    useFrame(() => {
        if (ref.current) {
            const { frequencyData } = audioStore.getState();
            const { bass } = frequencyData;
            const targetIntensity = 0.5 + (bass * 1.5);
            ref.current.intensity = THREE.MathUtils.lerp(ref.current.intensity, targetIntensity, 0.1);
        }
    });

    return (
        <Bloom
            ref={ref}
            luminanceThreshold={1}
            mipmapBlur
            intensity={0.5}
            radius={0.4}
        />
    );
}

function ReactiveGlitch() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ref = useRef<any>(null);

    useFrame(() => {
        if (ref.current) {
            const { frequencyData } = audioStore.getState();
            const { high } = frequencyData;
            const targetVal = high * 0.005;
            const current = ref.current.offset;

            if (current && typeof current.lerp === 'function') {
                current.lerp(new THREE.Vector2(targetVal, targetVal), 0.2);
            } else if (Array.isArray(current)) {
                const next = THREE.MathUtils.lerp(current[0], targetVal, 0.2);
                ref.current.offset = [next, next];
            } else {
                ref.current.offset = [targetVal, targetVal];
            }
        }
    });

    return (
        <ChromaticAberration
            ref={ref}
            offset={[0, 0]}
            radialModulation={false}
            modulationOffset={0}
        />
    );
}

export default function Effects() {
    return (
        <EffectComposer>
            <ReactiveBloom />
            <ReactiveGlitch />
            <Noise opacity={0.02} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
    );
}
