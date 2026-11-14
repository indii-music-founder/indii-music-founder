import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine, workflowCanonicalMaster } from './WorkflowEngine';
import {
    CustomNode,
    CustomEdge,
    Status,
    NoteAsset,
    AudioQCAsset,
    MusicMetadataAsset,
    SplitSheetAsset,
    ReleasePackageAsset
} from '../types';

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mockAddNote = vi.fn().mockReturnValue('mock-new-note-456');

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user', name: 'Test User' },
            notes: [
                {
                    id: 'note-1',
                    title: 'Neon Drift Lyrics',
                    content: 'Driving through the rain, neon in my veins. Chorus: Hold on to the night.',
                    tags: ['lyrics', 'electronic']
                }
            ],
            addNote: mockAddNote
        })
    }
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn().mockResolvedValue({
            response: { text: () => 'AI generated text' }
        })
    },
    getResponseText: vi.fn().mockImplementation((r) => r?.response?.text ? r.response.text() : (typeof r === 'string' ? r : JSON.stringify(r)))
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn().mockResolvedValue([{ url: 'https://image.example.com/art.jpg' }])
    }
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn().mockResolvedValue([{ id: 'vid-1', url: 'https://video.example.com/clip.mp4', prompt: 'test' }])
    }
}));

vi.mock('@/services/social/SocialService', () => ({
    SocialService: {
        createPost: vi.fn().mockResolvedValue('post-id-123')
    }
}));

vi.mock('@/services/rag/ragService', () => ({
    runAgenticWorkflow: vi.fn().mockResolvedValue({
        asset: { content: 'RAG Result Content' },
        updatedProfile: null
    })
}));

vi.mock('@/services/storage/repository', () => ({
    saveWorkflowToStorage: vi.fn().mockResolvedValue(undefined),
    getWorkflowFromStorage: vi.fn().mockResolvedValue(null)
}));

vi.mock('@/services/creative/CreativeStorageService', () => ({
    CreativeStorageService: { uploadReferenceMedia: vi.fn().mockResolvedValue('gs://test-bucket/owned-reference.png') }
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user', displayName: 'Neon Artist', email: 'artist@indii.music' } },
    db: {},
    storage: {},
    functions: {},
    functionsWest1: {}
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal linear workflow: input → dept/logic → output */
function makeLinearWorkflow(middleNode: CustomNode): {
    nodes: CustomNode[];
    edges: CustomEdge[];
} {
    const input: CustomNode = {
        id: 'start',
        type: 'inputNode',
        position: { x: 0, y: 0 },
        data: { nodeType: 'input', prompt: 'Test prompt', status: Status.PENDING }
    };
    const output: CustomNode = {
        id: 'end',
        type: 'outputNode',
        position: { x: 600, y: 0 },
        data: { nodeType: 'output', status: Status.PENDING }
    };
    return {
        nodes: [input, middleNode, output],
        edges: [
            { id: 'e1', source: 'start', target: middleNode.id },
            { id: 'e2', source: middleNode.id, target: 'end' }
        ]
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WorkflowEngine', () => {
    const mockSetNodes = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Silence HTMLMediaElement errors in jsdom
        for (const method of ['load', 'play', 'pause'] as const) {
            Object.defineProperty(window.HTMLMediaElement.prototype, method, {
                configurable: true,
                writable: true,
                value: method === 'play' ? vi.fn().mockResolvedValue(undefined) : vi.fn()
            });
        }
    });

    it('rejects a raw audio URL at the beat-synced render boundary', async () => {
        const brokenInputs = { audio_input: 'https://example.com/raw.mp3' };
        expect(() => workflowCanonicalMaster(brokenInputs)).toThrow(
            'This video workflow requires a verified canonical master reference, not an audio URL.'
        );
    });

    it('executes Knowledge Base node and calls RAG service', async () => {
        const kbNode: CustomNode = {
            id: 'kb-1',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Knowledge Base',
                selectedJobId: 'kb-query',
                status: Status.PENDING,
                prompt: 'What is our brand tone?'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(kbNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { runAgenticWorkflow } = await import('@/services/rag/ragService');
        expect(runAgenticWorkflow).toHaveBeenCalled();
    });

    it('executes Art Department node and calls ImageGeneration', async () => {
        const artNode: CustomNode = {
            id: 'art-1',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Art Department',
                selectedJobId: 'art-department-job-0',
                status: Status.PENDING,
                prompt: 'Album cover art'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(artNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
            expect.objectContaining({ prompt: expect.stringContaining('Album cover art') })
        );
    });

    it('preserves the selected source image in a refinement request', async () => {
        const refineNode: CustomNode = {
            id: 'refine',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Art Department',
                selectedJobId: 'art-upscale',
                status: Status.PENDING,
                prompt: 'Add grain'
            }
        };
        const input: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'https://images.example.com/source.png', status: Status.PENDING }
        };
        const output: CustomNode = {
            id: 'end',
            type: 'outputNode',
            position: { x: 600, y: 0 },
            data: { nodeType: 'output', status: Status.PENDING }
        };
        const nodes = [input, refineNode, output];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'refine', targetHandle: 'image_input' },
            { id: 'e2', source: 'refine', target: 'end' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { CreativeStorageService } = await import('@/services/creative/CreativeStorageService');
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        expect(CreativeStorageService.uploadReferenceMedia).toHaveBeenCalledWith(
            'test-user',
            'https://images.example.com/source.png',
            'image'
        );
        expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
            expect.objectContaining({
                referenceUris: ['gs://test-bucket/owned-reference.png'],
                resolution: '4K'
            })
        );
    });

    it('does not replace missing refinement input with unrelated text-to-image', async () => {
        const refineNode: CustomNode = {
            id: 'refine',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Art Department',
                selectedJobId: 'art-upscale',
                status: Status.PENDING,
                prompt: 'Add grain'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(refineNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        expect(ImageGeneration.generateImages).not.toHaveBeenCalled();
        expect(mockSetNodes).toHaveBeenCalledWith(expect.any(Function));
    });

    it('executes Video Department (text-to-video) and calls VideoGeneration', async () => {
        const videoNode: CustomNode = {
            id: 'vid-1',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Video Department',
                selectedJobId: 'video-department-job-0',
                status: Status.PENDING,
                prompt: 'A car driving at night'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(videoNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { VideoGeneration } = await import('@/services/video/VideoGenerationService');
        expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
            expect.objectContaining({ prompt: expect.stringContaining('A car driving at night') })
        );
    });

    it('executes Video Department img-to-video with imageUrl from input', async () => {
        const vidNode: CustomNode = {
            id: 'vid-img',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Video Department',
                selectedJobId: 'video-img-to-video',
                status: Status.PENDING,
                prompt: 'Animate this'
            }
        };
        const input: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'https://images.example.com/source.png', status: Status.PENDING }
        };
        const output: CustomNode = {
            id: 'end',
            type: 'outputNode',
            position: { x: 600, y: 0 },
            data: { nodeType: 'output', status: Status.PENDING }
        };
        const nodes = [input, vidNode, output];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'vid-img', targetHandle: 'image_input' },
            { id: 'e2', source: 'vid-img', target: 'end' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { VideoGeneration } = await import('@/services/video/VideoGenerationService');
        expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
            expect.objectContaining({ firstFrame: 'https://images.example.com/source.png' })
        );
    });

    it('returns Social Media draft copy without creating a public post', async () => {
        const socialNode: CustomNode = {
            id: 'soc-1',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Social Media Department',
                selectedJobId: 'social-media-department-job-0',
                status: Status.PENDING,
                prompt: 'Announce new track'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(socialNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { SocialService } = await import('@/services/social/SocialService');
        expect(SocialService.createPost).not.toHaveBeenCalled();
    });

    it('executes Marketing Department node and generates copy', async () => {
        const mktNode: CustomNode = {
            id: 'mkt-1',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Marketing Department',
                selectedJobId: 'marketing-department-job-0',
                status: Status.PENDING,
                prompt: 'Write ad copy for new single'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(mktNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
        expect(AutonomousIntelligence.generateContent).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    parts: expect.arrayContaining([
                        expect.objectContaining({ text: expect.stringContaining('Write marketing copy') })
                    ])
                })
            ]),
            expect.any(String)
        );
    });

    it('Router routes to the true branch when condition evaluates to true', async () => {
        const routerNode: CustomNode = {
            id: 'router',
            type: 'logicNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'logic',
                jobId: 'router',
                label: 'Check Data',
                status: Status.PENDING,
                config: { condition: '$data.includes("yes")' }
            }
        };
        const trueTarget: CustomNode = {
            id: 'true-dept',
            type: 'departmentNode',
            position: { x: 600, y: -100 },
            data: { nodeType: 'department', departmentName: 'Marketing Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const falseTarget: CustomNode = {
            id: 'false-dept',
            type: 'departmentNode',
            position: { x: 600, y: 100 },
            data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const inputNode: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'yes please', status: Status.PENDING }
        };
        const nodes = [inputNode, routerNode, trueTarget, falseTarget];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'router' },
            { id: 'e-true', source: 'router', target: 'true-dept', sourceHandle: 'true' },
            { id: 'e-false', source: 'router', target: 'false-dept', sourceHandle: 'false' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        expect(AutonomousIntelligence.generateContent).toHaveBeenCalled();
        expect(ImageGeneration.generateImages).not.toHaveBeenCalled();
    });

    it('Router routes to the false branch when condition evaluates to false', async () => {
        const routerNode: CustomNode = {
            id: 'router',
            type: 'logicNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'logic',
                jobId: 'router',
                label: 'Check Data',
                status: Status.PENDING,
                config: { condition: '$data.includes("yes")' }
            }
        };
        const trueTarget: CustomNode = {
            id: 'true-dept',
            type: 'departmentNode',
            position: { x: 600, y: -100 },
            data: { nodeType: 'department', departmentName: 'Marketing Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const falseTarget: CustomNode = {
            id: 'false-dept',
            type: 'departmentNode',
            position: { x: 600, y: 100 },
            data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const inputNode: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'no thank you', status: Status.PENDING }
        };
        const nodes = [inputNode, routerNode, trueTarget, falseTarget];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'router' },
            { id: 'e-true', source: 'router', target: 'true-dept', sourceHandle: 'true' },
            { id: 'e-false', source: 'router', target: 'false-dept', sourceHandle: 'false' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        expect(ImageGeneration.generateImages).toHaveBeenCalled();
        expect(AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
    });

    it('Router delegates natural language conditions to TypeSafe AI (JEV System One)', async () => {
        vi.doMock('@/config/typesafeJudgments', () => ({
            judgeWorkflowCondition: vi.fn().mockResolvedValue(true)
        }));

        const routerNode: CustomNode = {
            id: 'router',
            type: 'logicNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'logic',
                jobId: 'router',
                label: 'Semantic Check',
                status: Status.PENDING,
                config: { condition: 'Is this track suitable for summer playlisting?' }
            }
        };
        const trueTarget: CustomNode = {
            id: 'true-dept',
            type: 'departmentNode',
            position: { x: 600, y: -100 },
            data: { nodeType: 'department', departmentName: 'Marketing Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const falseTarget: CustomNode = {
            id: 'false-dept',
            type: 'departmentNode',
            position: { x: 600, y: 100 },
            data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const inputNode: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'Uplifting tropical house groove', status: Status.PENDING }
        };
        const nodes = [inputNode, routerNode, trueTarget, falseTarget];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'router' },
            { id: 'e-true', source: 'router', target: 'true-dept', sourceHandle: 'true' },
            { id: 'e-false', source: 'router', target: 'false-dept', sourceHandle: 'false' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        await engine.run();

        const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        expect(AutonomousIntelligence.generateContent).toHaveBeenCalled();
        expect(ImageGeneration.generateImages).not.toHaveBeenCalled();
    });


    it('Variables set/get share values via the blackboard', async () => {
        const setNode: CustomNode = {
            id: 'set-1',
            type: 'logicNode',
            position: { x: 200, y: 0 },
            data: { nodeType: 'logic', jobId: 'set_variable', label: 'Set', status: Status.PENDING, config: { variableKey: 'myKey' } }
        };
        const getNode: CustomNode = {
            id: 'get-1',
            type: 'logicNode',
            position: { x: 400, y: 0 },
            data: { nodeType: 'logic', jobId: 'get_variable', label: 'Get', status: Status.PENDING, config: { variableKey: 'myKey' } }
        };
        const outputNode: CustomNode = {
            id: 'end',
            type: 'outputNode',
            position: { x: 600, y: 0 },
            data: { nodeType: 'output', status: Status.PENDING }
        };
        const inputNode: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'stored-value-xyz', status: Status.PENDING }
        };
        const nodes = [inputNode, setNode, getNode, outputNode];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'set-1' },
            { id: 'e2', source: 'set-1', target: 'get-1' },
            { id: 'e3', source: 'get-1', target: 'end' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();
        expect(results.get('get-1')).toBe('stored-value-xyz');
    });

    it('Gatekeeper pauses at WAITING_FOR_APPROVAL and resumes when approved', async () => {
        const gatekeeperNode: CustomNode = {
            id: 'gate',
            type: 'logicNode',
            position: { x: 300, y: 0 },
            data: { nodeType: 'logic', jobId: 'gatekeeper', label: 'Gate', status: Status.PENDING, config: { message: 'Approve?' } }
        };
        const approvedNode: CustomNode = {
            id: 'approved',
            type: 'outputNode',
            position: { x: 600, y: -100 },
            data: { nodeType: 'output', status: Status.PENDING }
        };
        const inputNode: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'asset to review', status: Status.PENDING }
        };
        const nodes = [inputNode, gatekeeperNode, approvedNode];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'gate' },
            { id: 'e-approve', source: 'gate', target: 'approved', sourceHandle: 'approve' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const runPromise = engine.run();

        await new Promise(r => setTimeout(r, 100));

        engine.resolveGatekeeper('gate', true);
        await runPromise;

        expect(mockSetNodes).toHaveBeenCalled();
        expect(mockSetNodes.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('Gatekeeper routes to reject branch when rejected', async () => {
        const gatekeeperNode: CustomNode = {
            id: 'gate',
            type: 'logicNode',
            position: { x: 300, y: 0 },
            data: { nodeType: 'logic', jobId: 'gatekeeper', label: 'Gate', status: Status.PENDING, config: {} }
        };
        const approvedNode: CustomNode = {
            id: 'approved',
            type: 'departmentNode',
            position: { x: 600, y: -100 },
            data: { nodeType: 'department', departmentName: 'Marketing Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const rejectedNode: CustomNode = {
            id: 'rejected',
            type: 'departmentNode',
            position: { x: 600, y: 100 },
            data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'custom', status: Status.PENDING }
        };
        const inputNode: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'asset', status: Status.PENDING }
        };
        const nodes = [inputNode, gatekeeperNode, approvedNode, rejectedNode];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'gate' },
            { id: 'e-approve', source: 'gate', target: 'approved', sourceHandle: 'approve' },
            { id: 'e-reject', source: 'gate', target: 'rejected', sourceHandle: 'reject' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const runPromise = engine.run();

        await new Promise(r => setTimeout(r, 100));

        engine.resolveGatekeeper('gate', false);
        await runPromise;

        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
        expect(ImageGeneration.generateImages).toHaveBeenCalled();
        expect(AutonomousIntelligence.generateContent).not.toHaveBeenCalled();
    });

    // ── NEW MUSIC INDUSTRY & NOTES TESTS ─────────────────────────────────────

    it('executes Notes Department note-input and retrieves matching note', async () => {
        const noteInputNode: CustomNode = {
            id: 'note-in',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Notes Department',
                selectedJobId: 'note-input',
                status: Status.PENDING,
                prompt: 'Neon Drift'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(noteInputNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        const noteResult = results.get('note-in') as NoteAsset;
        expect(noteResult).toBeDefined();
        expect(noteResult.assetType).toBe('note');
        expect(noteResult.title).toBe('Neon Drift Lyrics');
        expect(noteResult.content).toContain('Driving through the rain');
    });

    it('executes Notes Department lyrics-extract and parses structure', async () => {
        const lyricsNode: CustomNode = {
            id: 'lyrics-node',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Notes Department',
                selectedJobId: 'lyrics-extract',
                status: Status.PENDING,
                prompt: 'Driving through the rain, neon in my veins. Chorus: Hold on to the night.'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(lyricsNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
        expect(AutonomousIntelligence.generateContent).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    parts: expect.arrayContaining([
                        expect.objectContaining({ text: expect.stringContaining('Extract and format the song structure') })
                    ])
                })
            ]),
            expect.any(String)
        );
        expect(results.get('lyrics-node')).toBe('AI generated text');
    });

    it('executes Notes Department note-save and stores release recipe into Notes', async () => {
        const saveNode: CustomNode = {
            id: 'save-node',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Notes Department',
                selectedJobId: 'note-save',
                status: Status.PENDING,
                prompt: 'Release Recipe for Neon Drift'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(saveNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        expect(mockAddNote).toHaveBeenCalledWith(expect.objectContaining({
            title: expect.stringContaining('Release Recipe'),
            tags: expect.arrayContaining(['release-recipe'])
        }));

        const savedAsset = results.get('save-node') as NoteAsset;
        expect(savedAsset.assetType).toBe('note');
        expect(savedAsset.noteId).toBe('mock-new-note-456');
    });

    it('executes Music Department audio-qc and validates DSP streaming specs', async () => {
        const qcNode: CustomNode = {
            id: 'qc-node',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Music Department',
                selectedJobId: 'music-audio-qc',
                status: Status.PENDING
            }
        };
        const input: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'verified-master-ref', status: Status.PENDING }
        };
        const output: CustomNode = {
            id: 'end',
            type: 'outputNode',
            position: { x: 600, y: 0 },
            data: { nodeType: 'output', status: Status.PENDING }
        };
        const nodes = [input, qcNode, output];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'qc-node', targetHandle: 'audio_input' },
            { id: 'e2', source: 'qc-node', target: 'end' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        const qcAsset = results.get('qc-node') as AudioQCAsset;
        expect(qcAsset.assetType).toBe('audio_qc');
        expect(qcAsset.pass).toBe(true);
        expect(qcAsset.integratedLufs).toBe(-14.0);
        expect(qcAsset.truePeakDbfs).toBe(-1.0);
        expect(qcAsset.clippingDetected).toBe(false);
    });

    it('executes Music Department metadata and assigns ISRC and UPC', async () => {
        const metaNode: CustomNode = {
            id: 'meta-node',
            type: 'departmentNode',
            position: { x: 200, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Music Department',
                selectedJobId: 'music-metadata',
                status: Status.PENDING,
                prompt: 'Neon Drift'
            }
        };
        const isrcNode: CustomNode = {
            id: 'isrc-node',
            type: 'departmentNode',
            position: { x: 400, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Music Department',
                selectedJobId: 'music-isrc-assign',
                status: Status.PENDING
            }
        };
        const upcNode: CustomNode = {
            id: 'upc-node',
            type: 'departmentNode',
            position: { x: 600, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Music Department',
                selectedJobId: 'music-upc-assign',
                status: Status.PENDING
            }
        };
        const input: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'Neon Drift Single', status: Status.PENDING }
        };
        const output: CustomNode = {
            id: 'end',
            type: 'outputNode',
            position: { x: 800, y: 0 },
            data: { nodeType: 'output', status: Status.PENDING }
        };

        const nodes = [input, metaNode, isrcNode, upcNode, output];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'meta-node' },
            { id: 'e2', source: 'meta-node', target: 'isrc-node' },
            { id: 'e3', source: 'isrc-node', target: 'upc-node' },
            { id: 'e4', source: 'upc-node', target: 'end' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        const finalMeta = results.get('upc-node') as MusicMetadataAsset;
        expect(finalMeta.assetType).toBe('metadata');
        expect(finalMeta.title).toBe('Neon Drift');
        expect(finalMeta.isrc).toMatch(/^US-S1Z-\d{2}-\d{5}$/);
        expect(finalMeta.upc).toMatch(/^198\d{9}$/);
    });

    it('executes Splits & Rights Department and verifies 100% balance', async () => {
        const splitsNode: CustomNode = {
            id: 'splits-node',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Splits & Rights Department',
                selectedJobId: 'splits-compiler',
                status: Status.PENDING,
                prompt: 'Neon Drift'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(splitsNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        const splitAsset = results.get('splits-node') as SplitSheetAsset;
        expect(splitAsset.assetType).toBe('splits');
        expect(splitAsset.totalMasterPercentage).toBe(100);
        expect(splitAsset.totalPublishingPercentage).toBe(100);
        expect(splitAsset.isBalanced).toBe(true);
        expect(splitAsset.contributors.length).toBe(2);
    });

    it('executes Distribution & Release Department ddex-preflight', async () => {
        const preflightNode: CustomNode = {
            id: 'ddex-node',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Distribution & Release Department',
                selectedJobId: 'ddex-preflight',
                status: Status.PENDING
            }
        };
        const input: CustomNode = {
            id: 'start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: {
                nodeType: 'input',
                prompt: 'Ready package',
                status: Status.PENDING
            }
        };
        const output: CustomNode = {
            id: 'end',
            type: 'outputNode',
            position: { x: 600, y: 0 },
            data: { nodeType: 'output', status: Status.PENDING }
        };
        const nodes = [input, preflightNode, output];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'ddex-node' },
            { id: 'e2', source: 'ddex-node', target: 'end' }
        ];

        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        const pkg = results.get('ddex-node') as ReleasePackageAsset;
        expect(pkg.assetType).toBe('release_package');
        expect(pkg.readyForDelivery).toBe(true);
        expect(pkg.checklist.length).toBeGreaterThanOrEqual(5);
    });

    it('subgraphNode recursively executes a nested micro-workflow and forwards its terminal output to downstream parent nodes', async () => {
        // Build a 2-node inner workflow: inputNode → art departmentNode
        const innerInput: CustomNode = {
            id: 'inner-start',
            type: 'inputNode',
            position: { x: 0, y: 0 },
            data: { nodeType: 'input', prompt: 'micro art prompt', status: Status.PENDING }
        };
        const innerArt: CustomNode = {
            id: 'inner-art',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Art Department',
                selectedJobId: 'art-department-job-0',
                status: Status.PENDING,
                prompt: 'micro art prompt'
            }
        };
        const innerOutput: CustomNode = {
            id: 'inner-end',
            type: 'outputNode',
            position: { x: 600, y: 0 },
            data: { nodeType: 'output', status: Status.PENDING }
        };

        // Wrap those inner nodes into a parent subgraphNode
        const subgraphNode: CustomNode = {
            id: 'micro-art-node',
            type: 'subgraphNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'subgraph',
                label: 'Micro Art Suite',
                description: 'Nested micro-workflow containing 3 steps',
                subgraph: {
                    nodes: [innerInput, innerArt, innerOutput],
                    edges: [
                        { id: 'ie1', source: 'inner-start', target: 'inner-art' },
                        { id: 'ie2', source: 'inner-art', target: 'inner-end' }
                    ]
                },
                status: Status.PENDING
            }
        };

        const { nodes, edges } = makeLinearWorkflow(subgraphNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);
        const results = await engine.run();

        // The parent subgraphNode output should be the terminal result of the inner workflow
        const subOutput = results.get('micro-art-node');
        expect(subOutput).toBeDefined();
        // Inner art node produces an image URL — that should bubble up through inner-end → parent
        expect(subOutput).toBe('https://image.example.com/art.jpg');
    });

    it('ComfyUI content-addressable cache memoizes node execution and avoids redundant AI calls', async () => {
        const artNode: CustomNode = {
            id: 'art-cached',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Art Department',
                selectedJobId: 'art-department-job-0',
                status: Status.PENDING,
                prompt: 'Identical artwork prompt'
            }
        };
        const { nodes, edges } = makeLinearWorkflow(artNode);
        const engine = new WorkflowEngine(nodes, edges, mockSetNodes);

        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

        // Run 1: cold execution -> calls ImageGeneration
        await engine.run();
        expect(ImageGeneration.generateImages).toHaveBeenCalledTimes(1);

        // Run 2: second execution with same inputs -> memoized cache hit!
        const onCompleteCallback = vi.fn();
        await engine.run({ callbacks: { onNodeComplete: onCompleteCallback } });

        // Generation count must STILL be 1 (bypassed via cache!)
        expect(ImageGeneration.generateImages).toHaveBeenCalledTimes(1);
        expect(onCompleteCallback).toHaveBeenCalledWith('art-cached', 'https://image.example.com/art.jpg', true);

        // Run 3: explicit bypassCache: true -> forces recomputation
        await engine.run({ bypassCache: true });
        expect(ImageGeneration.generateImages).toHaveBeenCalledTimes(2);
    });

    it('rejects unsupported departments like Live & Booking Department and prevents output aggregation from marking DONE (ISSUE-1613)', async () => {
        const nodes: CustomNode[] = [
            { id: 'start', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input', prompt: 'Regional tour QA brief', status: Status.PENDING } },
            {
                id: 'booking-1',
                type: 'departmentNode',
                position: { x: 300, y: 0 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Live & Booking Department',
                    selectedJobId: 'custom',
                    status: Status.PENDING,
                }
            },
            {
                id: 'marketing-1',
                type: 'departmentNode',
                position: { x: 300, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Marketing Department',
                    selectedJobId: 'marketing-department-job-0',
                    status: Status.PENDING,
                }
            },
            { id: 'end', type: 'outputNode', position: { x: 600, y: 75 }, data: { nodeType: 'output', status: Status.PENDING } },
        ];
        const edges: CustomEdge[] = [
            { id: 'e1', source: 'start', target: 'booking-1' },
            { id: 'e2', source: 'start', target: 'marketing-1' },
            { id: 'e3', source: 'booking-1', target: 'end' },
            { id: 'e4', source: 'marketing-1', target: 'end' },
        ];

        let latestNodes = nodes;
        const trackingSetNodes = (updater: CustomNode[] | ((prev: CustomNode[]) => CustomNode[])) => {
            latestNodes = typeof updater === 'function' ? updater(latestNodes) : updater;
        };

        const engine = new WorkflowEngine(nodes, edges, trackingSetNodes);
        const results = await engine.run();

        const bookingNode = latestNodes.find(n => n.id === 'booking-1');
        expect(bookingNode?.data.status).toBe(Status.ERROR);
        expect(bookingNode?.data.result).toBe(
            'Department "Live & Booking Department" does not have a supported execution handler.'
        );

        const endNode = latestNodes.find(n => n.id === 'end');
        expect(endNode?.data.status).toBe(Status.ERROR);
        expect(String(endNode?.data.result)).toContain('Upstream branch failed (Live & Booking Department)');
        expect(results.get('booking-1')).toBeUndefined();
    });
});
