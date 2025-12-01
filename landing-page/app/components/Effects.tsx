'use client';

import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';

export default function Effects() {
    return (
        <EffectComposer>
            <Bloom
                luminanceThreshold={1}
                mipmapBlur
                intensity={0.5}
                radius={0.4}
            />
            <Noise opacity={0.02} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
    );
}
