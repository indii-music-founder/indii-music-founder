import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { BlenderStatus, BlenderRenderEngine } from './types.js';

const execFileAsync = promisify(execFile);

export function getPotentialBlenderPaths(): string[] {
    const customPath = process.env.BLENDER_PATH;
    const paths: string[] = [];

    if (customPath) {
        paths.push(customPath);
    }

    if (process.platform === 'darwin') {
        paths.push(
            '/Applications/Blender.app/Contents/MacOS/Blender',
            '/opt/homebrew/bin/blender',
            '/usr/local/bin/blender',
            path.join(process.env.HOME || '', 'Applications/Blender.app/Contents/MacOS/Blender')
        );

        // Check for versioned apps like /Applications/Blender 4.3.app
        try {
            const apps = fs.readdirSync('/Applications');
            for (const app of apps) {
                if (app.startsWith('Blender') && app.endsWith('.app')) {
                    const candidate = path.join('/Applications', app, 'Contents/MacOS/Blender');
                    if (!paths.includes(candidate)) {
                        paths.push(candidate);
                    }
                }
            }
        } catch {
            // Ignore error if /Applications is unreadable
        }
    } else if (process.platform === 'win32') {
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        paths.push(
            path.join(programFiles, 'Blender Foundation', 'Blender', 'blender.exe'),
            path.join(programFiles, 'Blender Foundation', 'Blender 4.3', 'blender.exe'),
            path.join(programFiles, 'Blender Foundation', 'Blender 4.2', 'blender.exe'),
            path.join(programFiles, 'Blender Foundation', 'Blender 4.1', 'blender.exe'),
            path.join(programFiles, 'Blender Foundation', 'Blender 4.0', 'blender.exe')
        );
    } else {
        // Linux / BSD
        paths.push(
            '/usr/bin/blender',
            '/snap/bin/blender',
            '/usr/local/bin/blender'
        );
    }

    return paths;
}

export async function findBlenderExecutable(): Promise<string | null> {
    const candidates = getPotentialBlenderPaths();
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            try {
                // Ensure executable permissions
                fs.accessSync(candidate, fs.constants.X_OK);
                return candidate;
            } catch {
                // File exists but not executable
                continue;
            }
        }
    }
    return null;
}

export function detectGpuAcceleration(): 'Metal' | 'CUDA' | 'OptiX' | 'HIP' | 'CPU' | 'None' {
    if (process.platform === 'darwin') {
        // Apple Silicon Macs natively support Metal in Cycles and Eevee
        if (process.arch === 'arm64') {
            return 'Metal';
        }
        return 'CPU';
    }
    if (process.platform === 'win32' || process.platform === 'linux') {
        if (process.env.CUDA_PATH || process.env.CUDA_HOME) {
            return 'CUDA';
        }
    }
    return 'CPU';
}

export async function inspectBlenderVersion(executablePath: string): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync(executablePath, ['--version'], { timeout: 10000 });
        // Output format: "Blender 4.3.2 (hash ...)"
        const match = stdout.match(/Blender\s+([0-9]+\.[0-9]+(\.[0-9]+)?)/i);
        return match ? `Blender ${match[1]}` : stdout.split('\n')[0].trim();
    } catch {
        return null;
    }
}

export async function getBlenderStatus(isLiveConnected = false): Promise<BlenderStatus> {
    const executablePath = await findBlenderExecutable();
    const gpuAcceleration = detectGpuAcceleration();

    if (!executablePath) {
        const setup = process.platform === 'darwin'
            ? 'Blender not found. Install on macOS with `brew install --cask blender` or download from https://www.blender.org/download/'
            : process.platform === 'win32'
                ? 'Blender not found. Download installer from https://www.blender.org/download/ or install via `winget install BlenderFoundation.Blender`.'
                : 'Blender not found. Install on Linux via `sudo snap install blender --classic` or `sudo apt install blender`.';

        return {
            installed: false,
            executablePath: null,
            version: null,
            supportedEngines: [],
            gpuAcceleration: 'None',
            liveConnected: isLiveConnected,
            setupInstructions: setup
        };
    }

    const version = await inspectBlenderVersion(executablePath);
    const supportedEngines: BlenderRenderEngine[] = ['BLENDER_EEVEE_NEXT', 'CYCLES', 'WORKBENCH'];

    return {
        installed: true,
        executablePath,
        version,
        supportedEngines,
        gpuAcceleration,
        liveConnected: isLiveConnected
    };
}
