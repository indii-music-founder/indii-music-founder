const fs = require('fs');
const file = 'packages/renderer/src/services/agent/tools/SecurityTools.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`    apply_watermark: wrapTool('apply_watermark', async (args: { fileId: string; watermarkText: string; invisible?: boolean }) => {
        try {
            const securityApi = window.electronAPI?.security as import('@/types/electron').ElectronAPI['security'];

            if (!securityApi?.applyWatermark) {
                return toolError('Watermark bridge unavailable. No watermark was applied.', 'WATERMARK_BRIDGE_UNAVAILABLE');
            }

            const result = await securityApi.applyWatermark({
                fileId: args.fileId,
                text: args.watermarkText,
                invisible: args.invisible
            }) as any;

            if (!result.success) {
                return toolError(result.error || "Watermarking failed", "WATERMARK_FAILED");
            }

            return toolSuccess({
                fileId: args.fileId,
                watermarkText: args.watermarkText,
                status: 'APPLIED',
                watermarkedFileId: result.watermarkedFileId
            }, \`Watermark successfully applied to file \${args.fileId}.\`);
        } catch (e: unknown) {
            const error = e as Error;
            return toolError(\`Failed to apply watermark: \${error.message}\`);
        }
    })`,
`    apply_watermark: wrapTool('apply_watermark', async (args: { fileId: string; watermarkText: string; invisible?: boolean }) => {
        return toolError(
            'Watermarking requires a media processing backend which is currently unavailable. [NOT_SUPPORTED]',
            'NOT_SUPPORTED'
        );
    })`);

fs.writeFileSync(file, content);
