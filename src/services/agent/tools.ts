import { PUBLICIST_TOOLS } from '@/modules/publicist/tools';
import { ImageTools } from './tools/ImageTools';
import { VideoTools } from './tools/VideoTools';
import { MemoryTools } from './tools/MemoryTools';
import { AnalysisTools } from './tools/AnalysisTools';
import { SocialTools } from './tools/SocialTools';
import { CoreTools } from './tools/CoreTools';

export const TOOL_REGISTRY: Record<string, (args: any) => Promise<string>> = {
    ...CoreTools,
    ...ImageTools,
    ...VideoTools,
    ...MemoryTools,
    ...AnalysisTools,
    ...SocialTools,
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
11. open_project(projectId: string) - Open a specific project by ID.
12. delegate_task(agent_id: string, task: string, context?: any) - Delegate a sub-task to a specialized agent (ids: legal, marketing, music).
13. generate_video(prompt: string, image?: string, duration?: number) - Generate a video from text or image.
14. generate_motion_brush(image: string, mask: string, prompt?: string) - Animate a specific area of an image.
15. analyze_audio(audio: string) - Analyze an audio file (base64) for BPM, key, and energy.
16. analyze_contract(file_data: string, mime_type: string) - Analyze a legal contract (base64).
17. generate_social_post(platform: string, topic: string, tone?: string) - Generate a social media post.
18. save_memory(content: string, type?: 'fact' | 'summary' | 'rule') - Save a fact or rule to long-term memory.
19. recall_memories(query: string) - Search long-term memory for relevant info.
20. verify_output(goal: string, content: string) - Critique generated content against a goal.
21. request_approval(content: string) - Pause and ask the user for approval.
22. write_press_release(headline: string, company_name: string, key_points: string[], contact_info: string) - Write a press release.
23. generate_crisis_response(issue: string, sentiment: string, platform: string) - Generate a crisis response.
`;
