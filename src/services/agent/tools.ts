import { useStore } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
import { VideoGeneration } from '@/services/image/VideoGenerationService'; // Added for completeness
import { memoryService } from '@/services/agent/MemoryService';
import { AI } from '@/services/ai/AIService';
import { PUBLICIST_TOOLS } from '@/modules/publicist/tools';

export const TOOL_REGISTRY: Record<string, (args: any) => Promise<string>> = {
    save_memory: async (args: { content: string, type?: 'fact' | 'summary' | 'rule' }) => {
        try {
            const { currentProjectId } = useStore.getState();
            await memoryService.saveMemory(currentProjectId, args.content, args.type || 'fact');
            return `Memory saved: "${args.content}"`;
        } catch (e: any) {
            return `Failed to save memory: ${e.message}`;
        }
    },
    recall_memories: async (args: { query: string }) => {
        try {
            const { currentProjectId } = useStore.getState();
            const memories = await memoryService.retrieveRelevantMemories(currentProjectId, args.query);
            return memories.length > 0 ? `Relevant Memories:\n- ${memories.join('\n- ')}` : "No relevant memories found.";
        } catch (e: any) {
            return `Failed to recall memories: ${e.message}`;
        }
    },
    verify_output: async (args: { goal: string, content: string }) => {
        try {
            const prompt = `
            CRITIQUE REQUEST:
            Goal: "${args.goal}"
            Content to Verify: "${args.content}"
            
            Task: Rate this content on a scale of 1-10 based on how well it meets the goal. 
            If score < 7, provide specific improvements.
            Output JSON: { "score": number, "reason": "string", "pass": boolean }
            `;

            const res = await AI.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { responseMimeType: 'application/json' }
            });

            return `Verification Result: ${res.text()}`;
        } catch (e: any) {
            return `Verification failed: ${e.message}`;
        }
    },
    request_approval: async (args: { content: string, type?: string }) => {
        // This tool pauses execution and waits for user input.
        // In a real async agent system, this would suspend the workflow.
        // Here, we'll simulate a request by showing a toast or modal and returning a pending status.
        // Ideally, we'd update the store to show a modal.

        // For now, we'll just log it and return a message that tells the agent to wait.
        return `[APPROVAL REQUESTED] Content: "${args.content}". Please wait for user confirmation. (Note: UI integration pending)`;
    },
    set_mode: async (args) => {
        // In a real implementation, this would switch the module or UI state
        return `Switched to ${args.mode} mode (Simulation).`;
    },
    update_prompt: async (args) => {
        return `Prompt updated to: "${args.text}"`;
    },
    generate_image: async (args) => {
        try {
            const { studioControls, addToHistory, currentProjectId } = useStore.getState();

            const results = await ImageGeneration.generateImages({
                prompt: args.prompt || "A creative scene",
                count: args.count || 1,
                resolution: args.resolution || studioControls.resolution,
                aspectRatio: args.aspectRatio || studioControls.aspectRatio,
                negativePrompt: args.negativePrompt || studioControls.negativePrompt,
                seed: args.seed ? parseInt(args.seed) : (studioControls.seed ? parseInt(studioControls.seed) : undefined)
            });

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                });
                return `Successfully generated ${results.length} images. They are now in the Gallery.`;
            }
            return "Generation completed but no images were returned.";
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Image generation failed: ${e.message}`;
            }
            return `Image generation failed: An unknown error occurred.`;
        }
    },
    read_history: async () => {
        const history = useStore.getState().agentHistory;
        return history.slice(-5).map(h => `${h.role}: ${h.text.substring(0, 50)}...`).join('\n');
    },
    batch_edit_images: async (args: { prompt: string, imageIndices?: number[] }) => {
        try {
            const { uploadedImages, addToHistory, currentProjectId } = useStore.getState();

            if (uploadedImages.length === 0) {
                return "No images found in uploads to edit. Please upload images first.";
            }

            // Filter images if indices provided, otherwise use all
            const targetImages = args.imageIndices
                ? args.imageIndices.map(i => uploadedImages[i]).filter(Boolean)
                : uploadedImages;

            if (targetImages.length === 0) {
                return "No valid images found for the provided indices.";
            }

            // Convert HistoryItem to { mimeType, data } format
            // Assuming url is data:image/png;base64,...
            const imageDataList = targetImages.map(img => {
                const match = img.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    return { mimeType: match[1], data: match[2] };
                }
                return null;
            }).filter(img => img !== null) as { mimeType: string; data: string }[];

            if (imageDataList.length === 0) {
                return "Could not process image data from uploads.";
            }

            const results = await Editing.batchEdit({
                images: imageDataList,
                prompt: args.prompt,
                onProgress: (current, total) => {
                    useStore.getState().addAgentMessage({
                        id: crypto.randomUUID(),
                        role: 'system',
                        text: `Processing image ${current} of ${total}...`,
                        timestamp: Date.now()
                    });
                }
            });

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                });
                return `Successfully edited ${results.length} images based on instruction: "${args.prompt}".`;
            }
            return "Batch edit completed but no images were returned.";

        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Batch edit failed: ${e.message}`;
            }
            return `Batch edit failed: An unknown error occurred.`;
        }
    },
    batch_edit_videos: async (args: { prompt: string, videoIndices?: number[] }) => {
        try {
            const { uploadedImages, addToHistory, currentProjectId } = useStore.getState();

            // Filter for videos
            const allVideos = uploadedImages.filter(img => img.type === 'video');

            if (allVideos.length === 0) {
                return "No videos found in uploads to edit. Please upload videos first.";
            }

            // Filter videos if indices provided (indices refer to the filtered video list)
            const targetVideos = args.videoIndices
                ? args.videoIndices.map(i => allVideos[i]).filter(Boolean)
                : allVideos;

            if (targetVideos.length === 0) {
                return "No valid videos found for the provided indices.";
            }

            const videoDataList = targetVideos.map(vid => {
                const match = vid.url.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    return { mimeType: match[1], data: match[2] };
                }
                return null;
            }).filter(vid => vid !== null) as { mimeType: string; data: string }[];

            if (videoDataList.length === 0) {
                return "Could not process video data from uploads. Ensure they are valid data URIs.";
            }

            const results = await Editing.batchEditVideo({
                videos: videoDataList,
                prompt: args.prompt,
                onProgress: (current, total) => {
                    useStore.getState().addAgentMessage({
                        id: crypto.randomUUID(),
                        role: 'system',
                        text: `Processing video ${current} of ${total}...`,
                        timestamp: Date.now()
                    });
                }
            });

            if (results.length > 0) {
                results.forEach(res => {
                    addToHistory({
                        id: res.id,
                        url: res.url,
                        prompt: res.prompt,
                        type: 'video',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });
                });
                return `Successfully processed ${results.length} videos based on instruction: "${args.prompt}".`;
            }
            return "Batch video processing completed but no videos were returned.";

        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Batch video processing failed: ${e.message}`;
            }
            return `Batch video processing failed: An unknown error occurred.`;
        }
    },
    create_project: async (args: { name: string, type: 'creative' | 'music' | 'marketing' | 'legal' }) => {
        try {
            const { createNewProject, currentOrganizationId } = useStore.getState();
            await createNewProject(args.name, args.type || 'creative', currentOrganizationId);
            return `Successfully created project "${args.name}" (${args.type}) and switched to it.`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Failed to create project: ${e.message}`;
            }
            return `Failed to create project: An unknown error occurred.`;
        }
    },
    list_projects: async () => {
        const { projects, currentOrganizationId } = useStore.getState();
        const orgProjects = projects.filter(p => p.orgId === currentOrganizationId);

        if (orgProjects.length === 0) {
            return "No projects found in this organization.";
        }

        return orgProjects.map(p => `- ${p.name} (${p.type}) [ID: ${p.id}]`).join('\n');
    },
    switch_module: async (args: { module: string }) => {
        const validModules = ['creative', 'legal', 'music', 'marketing', 'video', 'workflow', 'dashboard'];
        if (validModules.includes(args.module)) {
            useStore.getState().setModule(args.module as any);
            return `Switched to ${args.module} module.`;
        }
        return `Invalid module. Available: ${validModules.join(', ')}`;
    },
    search_knowledge: async (args: { query: string }) => {
        try {
            // Import dynamically to avoid circular deps
            const { runAgenticWorkflow } = await import('../../services/rag/ragService');
            // We need an instance, but the service exports a class. 
            // Ideally we should use the singleton from ragService or instantiate here if we have the key.
            // Let's use the ragService export if available or instantiate.
            // For now, let's assume we can use the RAG service singleton if we export it, 
            // or just instantiate a temporary one if we have the key in env.
            // A better approach is to add a search method to the store or a service wrapper.

            // Import dynamically to avoid circular deps
            const { useStore } = await import('@/core/store');

            // We need to mock or provide the required arguments for runAgenticWorkflow
            // It expects: query, userProfile, activeTrack, onUpdate, _updateDocStatus

            const { userProfile } = useStore.getState();

            // Mock callbacks
            const onUpdate = (msg: string) => console.log(`[RAG]: ${msg}`);
            const onDocStatus = () => { };

            const result = await runAgenticWorkflow(args.query, userProfile, null, onUpdate, onDocStatus);
            return `RAG Search Result: ${result.asset.content}`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Knowledge search failed: ${e.message}`;
            }
            return `Knowledge search failed: An unknown error occurred.`;
        }
    },
    delegate_task: async (args: { agent_id: string, task: string, context?: any }) => {
        try {
            // Dynamic import to avoid circular dependency if registry imports tools
            const { agentRegistry } = await import('./registry');
            const agent = agentRegistry.get(args.agent_id);

            if (!agent) {
                return `Error: Agent '${args.agent_id}' not found. Available: ${agentRegistry.listCapabilities()}`;
            }

            const response = await agent.execute(args.task, args.context);
            return `[${agent.name}]: ${response.text}`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Delegation failed: ${e.message}`;
            }
            return `Delegation failed: An unknown error occurred.`;
        }
    },
    generate_video: async (args: { prompt: string, image?: string, duration?: number }) => {
        try {
            const { VideoGeneration } = await import('../../services/image/VideoGenerationService');

            let imageInput;
            if (args.image) {
                const match = args.image.match(/^data:(.+);base64,(.+)$/);
                if (match) {
                    imageInput = { mimeType: match[1], data: match[2] };
                }
            }

            const results = await VideoGeneration.generateVideo({
                prompt: args.prompt,
                firstFrame: args.image, // Assuming args.image is the first frame
                // durationSeconds: args.duration // VideoGenerationService doesn't support durationSeconds directly yet, it supports totalDuration for long form
            });

            if (results.length > 0) {
                const uri = results[0].url;
                const { addToHistory, currentProjectId } = useStore.getState();
                // We might want to fetch the blob here to store it properly or just store the URI
                // For now, let's assume URI is sufficient or we fetch it
                // Ideally, we should add it to history similar to images
                addToHistory({
                    id: crypto.randomUUID(),
                    url: uri,
                    prompt: args.prompt,
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                return `Video generated successfully: ${uri}`;
            }
            return "Video generation failed (no URI returned).";
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Video generation failed: ${e.message}`;
            }
            return `Video generation failed: An unknown error occurred.`;
        }
    },
    generate_motion_brush: async (args: { image: string, mask: string, prompt?: string }) => {
        try {
            const { Video } = await import('../../services/video/VideoService'); // Motion brush is in VideoService

            const imgMatch = args.image.match(/^data:(.+);base64,(.+)$/);
            const maskMatch = args.mask.match(/^data:(.+);base64,(.+)$/);

            if (!imgMatch || !maskMatch) {
                return "Invalid image or mask data. Must be base64 data URIs.";
            }

            const image = { mimeType: imgMatch[1], data: imgMatch[2] };
            const mask = { mimeType: maskMatch[1], data: maskMatch[2] };

            // Assuming Editing service has a generateMotionBrush method
            const uri = await Video.generateMotionBrush(image, mask);

            if (uri) {
                const { addToHistory, currentProjectId } = useStore.getState();
                addToHistory({
                    id: crypto.randomUUID(),
                    url: uri,
                    prompt: args.prompt || "Motion Brush",
                    type: 'video',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
                return `Motion Brush video generated successfully: ${uri}`;
            }
            return "Motion Brush generation failed.";
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Motion Brush failed: ${e.message}`;
            }
            return `Motion Brush failed: An unknown error occurred.`;
        }
    },
    analyze_audio: async (args: { audio: string }) => {
        try {
            // Dynamic import to avoid circular deps
            // We need to import the class, but it's not a singleton export in the file we saw?
            // Wait, AudioAnalysisEngine.ts exports the class. We need to instantiate it.
            const { AudioAnalysisEngine } = await import('../../modules/music/services/AudioAnalysisEngine');
            const engine = new AudioAnalysisEngine();

            const match = args.audio.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                return "Invalid audio data. Must be base64 data URI.";
            }

            const base64Data = match[2];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            const analysis = await engine.analyze(arrayBuffer);
            return `Audio Analysis Result: ${JSON.stringify(analysis, null, 2)}`;
        } catch (e: unknown) {
            if (e instanceof Error) {
                return `Audio analysis failed: ${e.message}`;
            }
            return `Audio analysis failed: An unknown error occurred.`;
        }
    },
    analyze_contract: async (args: { file_data: string, mime_type: string }) => {
        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');
            const analyzeContract = httpsCallable(functions, 'analyzeContract');
            const result = await analyzeContract({ fileData: args.file_data, mimeType: args.mime_type });
            const data = result.data as any;
            return `Contract Analysis:\nScore: ${data.score}\nSummary: ${data.summary}\nRisks: ${data.risks.join('\n- ')}`;
        } catch (e: any) {
            return `Contract analysis failed: ${e.message}`;
        }
    },
    generate_social_post: async (args: { platform: string, topic: string, tone?: string }) => {
        try {
            const { AI } = await import('@/services/ai/AIService');
            const prompt = `Generate a ${args.tone || 'professional'} social media post for ${args.platform} about ${args.topic}. Include hashtags.`;
            const result = await AI.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const text = result.text();

            const { addToHistory, currentProjectId } = useStore.getState();
            addToHistory({
                id: crypto.randomUUID(),
                url: '', // Text content doesn't have a URL usually, or we could save to a blob
                prompt: args.topic,
                type: 'text',
                timestamp: Date.now(),
                projectId: currentProjectId,
                meta: text
            });

            return `Generated Post for ${args.platform}:\n${text}`;
        } catch (e: any) {
            return `Social post generation failed: ${e.message}`;
        }
    },
    generate_music: async (args: { prompt: string, duration?: number }) => {
        try {
            const { addToHistory, currentProjectId } = useStore.getState();
            // Placeholder for actual music generation
            const id = crypto.randomUUID();
            addToHistory({
                id,
                url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Placeholder MP3
                prompt: args.prompt,
                type: 'music',
                timestamp: Date.now(),
                projectId: currentProjectId
            });
            return `Music generated for "${args.prompt}". (Placeholder audio used)`;
        } catch (e: any) {
            return `Music generation failed: ${e.message}`;
        }
    },
    ...PUBLICIST_TOOLS
};

export const BASE_TOOLS = `
AVAILABLE TOOLS:
1. set_mode(mode: string) - Switch studio mode.
2. update_prompt(text: string) - Write text into the prompt box.
3. generate_image(prompt: string, count: number) - Generate images.
4. read_history() - Read recent chat history.
5. batch_edit_images(prompt: string, imageIndices?: number[]) - Edit uploaded images with an instruction.
6. batch_edit_videos(prompt: string, videoIndices?: number[]) - Edit/Grade uploaded videos with an instruction.
7. create_project(name: string, type: string) - Create a new project (types: creative, music, marketing, legal).
8. list_projects() - List all projects in the current organization.
9. switch_module(module: string) - Navigate to a specific module.
10. search_knowledge(query: string) - Search the knowledge base for answers.

11. delegate_task(agent_id: string, task: string, context?: any) - Delegate a sub-task to a specialized agent (ids: legal, marketing, music).
12. generate_video(prompt: string, image?: string, duration?: number) - Generate a video from text or image.
13. generate_motion_brush(image: string, mask: string, prompt?: string) - Animate a specific area of an image.
14. analyze_audio(audio: string) - Analyze an audio file (base64) for BPM, key, and energy.
15. analyze_contract(file_data: string, mime_type: string) - Analyze a legal contract (base64).
15. analyze_contract(file_data: string, mime_type: string) - Analyze a legal contract (base66).
16. generate_social_post(platform: string, topic: string, tone?: string) - Generate a social media post.
17. generate_music(prompt: string, duration?: number) - Generate a music track.
18. save_memory(content: string, type?: 'fact' | 'summary' | 'rule') - Save a fact or rule to long-term memory.
19. recall_memories(query: string) - Search long-term memory for relevant info.
20. verify_output(goal: string, content: string) - Critique generated content against a goal.
21. request_approval(content: string) - Pause and ask the user for approval.
22. write_press_release(headline: string, company_name: string, key_points: string[], contact_info: string) - Write a press release.
23. generate_crisis_response(issue: string, sentiment: string, platform: string) - Generate a crisis response.
`;
