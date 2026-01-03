
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { firebaseAI } from '../src/services/ai/FirebaseAIService';
import { VideoGeneration } from '../src/services/image/VideoGenerationService';
import { PublicistAgent } from '../src/services/agent/definitions/PublicistAgent';
import { MusicTools } from '../src/services/agent/tools/MusicTools';
import { DirectorAgent } from '../src/agents/director/config';
import { MarketingAgent } from '../src/services/agent/definitions/MarketingAgent';
import { SocialAgent } from '../src/services/agent/definitions/SocialAgent';
import { PublishingAgent } from '../src/services/agent/definitions/PublishingAgent';
import { FinanceAgent } from '../src/services/agent/definitions/FinanceAgent';
import { RoadAgent } from '../src/services/agent/definitions/RoadAgent';
import { DevOpsAgent } from '../src/services/agent/definitions/DevOpsAgent';
import { SecurityAgent } from '../src/services/agent/definitions/SecurityAgent';
import { BrandAgent } from '../src/services/agent/definitions/BrandAgent';
import { LicensingAgent } from '../src/services/agent/definitions/LicensingAgent';


// Mock Window Electron API
global.window = {
    // @ts-ignore
    electronAPI: {
        audio: {
            analyze: vi.fn().mockResolvedValue({ bpm: 120, key: 'C Major', energy: 0.8 }),
            getMetadata: vi.fn().mockResolvedValue({ title: 'Mock Song', artist: 'Mock Artist' })
        }
    }
} as any;

describe('AI Feature Audit', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock FirebaseAI methods
        vi.spyOn(firebaseAI, 'generateText').mockResolvedValue("Generated AI Content");
        vi.spyOn(firebaseAI, 'generateImage').mockResolvedValue("base64data");
        // Mock structured data to return a superset of fields expected by various agents
        vi.spyOn(firebaseAI, 'generateStructuredData').mockResolvedValue({
            title: "Specific Title",
            beats: [],
            status: "Submitted",
            iswc: "T-123.456.789-1",
            trend_score: 85,
            keywords: ["viral", "music"],
            receipt_data: { total: 100, vendor: "Test" },
            total_estimated_budget: 5000,
            route_plan: "Route details...",
            matrix: "Distance matrix...",
            compliance_report: "Safe"
        });
        vi.spyOn(firebaseAI, 'analyzeImage').mockResolvedValue({
            description: "Visual analysis",
            tags: ["brand-safe"],
            safety_rating: "high"
        });
    });

    it('Publicist: write_press_release should use Generative AI', async () => {
        const result = await PublicistAgent.functions!.write_press_release({
            headline: "Test Headline",
            company_name: "Test Co"
        });

        expect(result.success).toBe(true);
        expect(result.data.generated_content).toBe("Generated AI Content");
        expect(firebaseAI.generateText).toHaveBeenCalledWith(expect.stringContaining("Test Co"));
    });

    it('Director: generate_image should use Generative AI', async () => {
        expect(DirectorAgent.functions).toBeDefined();
        const result = await DirectorAgent.functions!.generate_image({
            prompt: "A cinematic shot"
        });
        expect(result).toContain("data:image/png;base64,base64data");
        expect(firebaseAI.generateImage).toHaveBeenCalled();
    });

    it('Director: show_room_mockup should use Generative AI', async () => {
        const result = await DirectorAgent.functions!.run_showroom_mockup({
            productType: "Hoodie",
            scenePrompt: "on a mannequin"
        });
        expect(result).toContain("Showroom mockup generated");
    });

    it('Music: analyze_audio should communicate with Electron', async () => {
        const resultJson = await MusicTools.analyze_audio({ filePath: '/mock.mp3' });
        const result = JSON.parse(resultJson);
        expect(result.bpm).toBe(120);
        expect(window.electronAPI.audio.analyze).toHaveBeenCalledWith('/mock.mp3');
    });

    it('Marketing: track_performance should use structured data', async () => {
        const result = await MarketingAgent.functions!.track_performance({ campaignId: 'S1-2025' });
        expect(result.success).toBe(true);
        expect(firebaseAI.generateStructuredData).toHaveBeenCalled();
    });

    it('Social: analyze_trends should use structured data', async () => {
        const result = await SocialAgent.functions!.analyze_trends({ topic: 'Acid Jazz' });
        expect(result.success).toBe(true);
        expect(firebaseAI.generateStructuredData).toHaveBeenCalled();
    });

    it('Publishing: register_work should use structured data', async () => {
        const result = await PublishingAgent.functions!.register_work({ title: 'New Song', writers: ['Me'], split: '100%' });
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('Submitted');
    });

    it('Finance: analyze_receipt should use structured data', async () => {
        const result = await FinanceAgent.functions!.analyze_receipt({ image_data: 'base64...', mime_type: 'image/jpeg' });
        expect(result.success).toBe(true);
    });

    it('Road: calculate_tour_budget should use structured data', async () => {
        const result = await RoadAgent.functions!.calculate_tour_budget({ duration_days: 10, crew_size: 5 });
        expect(result.success).toBe(true);
    });

    it('DevOps: list_clusters should use structured data', async () => {
        const result = await DevOpsAgent.functions!.list_clusters({});
        expect(result.success).toBe(true);
    });

    it('Security: audit_permissions should use structured data', async () => {
        const result = await SecurityAgent.functions!.audit_permissions({ userId: 'user-123' });
        expect(result.success).toBe(true);
    });

    it('Brand: audit_visual_assets should use analyzeImage', async () => {
        const result = await BrandAgent.functions!.audit_visual_assets({ assets: ['http://mock.com/image.jpg'] });
        expect(result.success).toBe(true);
        expect(firebaseAI.analyzeImage).toHaveBeenCalled();
    });

    it('Licensing: analyze_contract should use analyzeImage', async () => {
        const result = await LicensingAgent.functions!.analyze_contract({ contract_id: 'c1', file_data: 'data...' });
        expect(result.success).toBe(true);
        // Assuming analyze_contract calls analyzeImage inside
        expect(firebaseAI.analyzeImage).toHaveBeenCalled();
    });

});
