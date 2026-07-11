const MAX_SCENE_MODEL_BYTES = 100 * 1024 * 1024;

export function validateSceneModelFile(file: Pick<File, 'name' | 'size'>): string | null {
    const extension = file.name.toLowerCase().split('.').pop();
    if (extension !== 'glb' && extension !== 'gltf') {
        return 'Please choose a valid .glb or .gltf 3D model file.';
    }
    if (file.size <= 0) return 'The selected 3D model is empty.';
    if (file.size > MAX_SCENE_MODEL_BYTES) return '3D models must be 100 MB or smaller.';
    return null;
}
