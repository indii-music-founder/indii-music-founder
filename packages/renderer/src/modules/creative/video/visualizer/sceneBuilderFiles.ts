const MAX_SCENE_MODEL_BYTES = 100 * 1024 * 1024;

function readFile(file: Blob, mode: 'arrayBuffer' | 'text'): Promise<ArrayBuffer | string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
        reader.onload = () => resolve(reader.result as ArrayBuffer | string);
        if (mode === 'arrayBuffer') reader.readAsArrayBuffer(file);
        else reader.readAsText(file);
    });
}

export function validateSceneModelFile(file: Pick<File, 'name' | 'size'>): string | null {
    const extension = file.name.toLowerCase().split('.').pop();
    if (extension !== 'glb' && extension !== 'gltf') {
        return 'Please choose a valid .glb or .gltf 3D model file.';
    }
    if (file.size <= 0) return 'The selected 3D model is empty.';
    if (file.size > MAX_SCENE_MODEL_BYTES) return '3D models must be 100 MB or smaller.';
    return null;
}

/** Lightweight structural check before a model reaches the WebGL loader. */
export async function validateSceneModelContents(file: File): Promise<string | null> {
    const extension = file.name.toLowerCase().split('.').pop();
    try {
        if (extension === 'glb') {
            const header = new Uint8Array(await readFile(file.slice(0, 12), 'arrayBuffer') as ArrayBuffer);
            const magic = String.fromCharCode(...header.slice(0, 4));
            if (magic !== 'glTF') return 'This .glb file is corrupt or is not a valid glTF binary model.';
            if (header.length < 12) return 'This .glb file is missing its required header.';
            return null;
        }
        const text = await readFile(file, 'text') as string;
        const parsed = JSON.parse(text) as { asset?: { version?: unknown } };
        if (typeof parsed.asset?.version !== 'string') return 'This .gltf file is missing its asset.version declaration.';
        return null;
    } catch {
        return extension === 'gltf'
            ? 'This .gltf file is not valid JSON and cannot be loaded.'
            : 'This model could not be decoded. Choose another GLB/GLTF file.';
    }
}
