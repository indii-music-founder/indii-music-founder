import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Runs real sockets/config contracts. No Blender module, service or account doubles.
describe('Blender bridge native security contracts', () => {
    for (const script of ['test_scene_command.py', 'test_render_config.py']) {
        it(script, () => {
            const result = spawnSync(process.env.PYTHON_PATH || 'python3', [path.join(__dirname, 'python', script)], {
                encoding: 'utf8', timeout: 15000,
            });
            expect(result.error, result.stderr).toBeUndefined();
            expect(result.status, result.stderr).toBe(0);
            expect(result.stderr).toContain('OK');
        });
    }
});
