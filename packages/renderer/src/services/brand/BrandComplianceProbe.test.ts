import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    detectObjects: vi.fn(),
    judgeBrandMarkCandidate: vi.fn(),
}));

vi.mock('@/services/image/ImageAnalysisService', () => ({
    imageAnalysisService: { detectObjects: mocks.detectObjects },
}));
vi.mock('@/config/typesafeJudgments', () => ({
    judgeBrandMarkCandidate: mocks.judgeBrandMarkCandidate,
}));

import { createDefaultVisionProbe } from './BrandComplianceService';

const objects = [
    { label: 'logo-shaped lettering', box: { ymin: 100, xmin: 100, ymax: 300, xmax: 400 } },
    { label: 'stage light', box: { ymin: 500, xmin: 500, ymax: 700, xmax: 700 } },
];

describe('brand logo vision probe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.detectObjects.mockResolvedValue(objects);
    });

    it('does not keep a label-based logo guess when Jev selects none', async () => {
        mocks.judgeBrandMarkCandidate.mockResolvedValue(null);

        await expect(createDefaultVisionProbe().detectLogo('data:image/png;base64,aGVsbG8='))
            .resolves.toBeNull();
        expect(mocks.judgeBrandMarkCandidate).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: 'obj_0' }),
            expect.objectContaining({ id: 'obj_1' }),
        ]));
    });

    it('uses the selected candidate box when Jev chooses a declared object', async () => {
        mocks.judgeBrandMarkCandidate.mockResolvedValue('obj_1');

        await expect(createDefaultVisionProbe().detectLogo('data:image/png;base64,aGVsbG8='))
            .resolves.toEqual({ ymin: 0.5, xmin: 0.5, ymax: 0.7, xmax: 0.7 });
    });
});
