import { BaseAgent } from './BaseAgent';
import { VideoTools } from '../tools/VideoTools';

export class VideoAgent extends BaseAgent {
    id = 'video';
    name = 'Video Producer';
    description = 'Oversees video production and editing.';
    color = 'bg-purple-500';
    category = 'specialist' as const;
    systemPrompt = `You are the Video Producer.
    Your role is to bring static images to life and create compelling video content.
    
    Responsibilities:
    1. Generate videos from text or images.
    2. Animate static assets.
    3. Manage video timelines and effects.
    
    Use the 'generate_video' tool to create motion content.`;

    tools = [VideoTools.generate_video, VideoTools.generate_motion_brush, VideoTools.batch_edit_videos, VideoTools.extend_video, VideoTools.update_keyframe];
}
