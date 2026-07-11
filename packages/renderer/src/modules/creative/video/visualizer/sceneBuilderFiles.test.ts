import { describe, expect, it } from 'vitest';
import { validateSceneModelFile } from './sceneBuilderFiles';

describe('validateSceneModelFile', () => {
    it.each(['stage.glb', 'stage.gltf', 'STAGE.GLB'])('accepts supported model files: %s', (name) => {
        expect(validateSceneModelFile({ name, size: 1024 })).toBeNull();
    });

    it('rejects unsupported, empty, and oversized files', () => {
        expect(validateSceneModelFile({ name: 'stage.obj', size: 1024 })).toMatch(/\.glb/);
        expect(validateSceneModelFile({ name: 'stage.glb', size: 0 })).toMatch(/empty/);
        expect(validateSceneModelFile({ name: 'stage.glb', size: 101 * 1024 * 1024 })).toMatch(/100 MB/);
    });
});
