import { describe, expect, it } from 'vitest';
import { validateSceneModelContents, validateSceneModelFile } from './sceneBuilderFiles';

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

describe('validateSceneModelContents', () => {
    it('accepts a GLB header and rejects a corrupt binary', async () => {
        await expect(validateSceneModelContents(new File([new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0])], 'stage.glb'))).resolves.toBeNull();
        await expect(validateSceneModelContents(new File(['not a model'], 'stage.glb'))).resolves.toMatch(/corrupt/);
    });

    it('requires a parseable GLTF asset declaration', async () => {
        await expect(validateSceneModelContents(new File(['{"asset":{"version":"2.0"}}'], 'stage.gltf'))).resolves.toBeNull();
        await expect(validateSceneModelContents(new File(['not json'], 'stage.gltf'))).resolves.toMatch(/valid JSON/);
    });
});
