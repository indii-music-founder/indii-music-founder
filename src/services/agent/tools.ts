import { PUBLICIST_TOOLS } from '@/modules/publicist/tools';
import { ImageTools } from './tools/ImageTools';
import { VideoTools } from './tools/VideoTools';
import { MemoryTools } from './tools/MemoryTools';
import { AnalysisTools } from './tools/AnalysisTools';
import { FinanceTools } from './tools/FinanceTools';
import { SocialTools } from './tools/SocialTools';
import { CoreTools } from './tools/CoreTools';
import { OrganizationTools } from './tools/OrganizationTools';
import { StorageTools } from './tools/StorageTools';
import { KnowledgeTools } from './tools/KnowledgeTools';
import { ProjectTools } from './tools/ProjectTools';
import { NavigationTools } from './tools/NavigationTools';
import { MapsTools } from './tools/MapsTools';
import { BrandTools } from './tools/BrandTools';
import { MarketingTools } from './tools/MarketingTools';
import { RoadTools } from './tools/RoadTools';
import { SecurityTools } from './tools/SecurityTools';
import { DevOpsTools } from './tools/DevOpsTools';
import { PublicistTools } from './tools/PublicistTools';
import { VALID_AGENT_IDS_LIST } from './types';

export const TOOL_REGISTRY: Record<string, (args: any) => Promise<string>> = {
    ...CoreTools,
    ...ImageTools,
    ...VideoTools,
    ...MemoryTools,
    ...AnalysisTools,
    ...SocialTools,
    ...OrganizationTools,
    ...StorageTools,
    ...KnowledgeTools,
    ...ProjectTools,
    ...NavigationTools,
    ...MapsTools,
    ...BrandTools,
    ...MarketingTools,
    ...RoadTools,
    ...SecurityTools,
    ...DevOpsTools,
    ...PublicistTools,
    ...PUBLICIST_TOOLS, // Keeping original specific publicist tools if they differ, or merge? PublicistTools covers the new requirements.
    ...FinanceTools
};

// Merging PUBLICIST_TOOLS might have overlap, but the new PublicistTools has specific implementations for write_press_release, etc.
// Let's assume PublicistTools takes precedence if names collide, due to spread order.

export const BASE_TOOLS = `
AVAILABLE TOOLS:
1. set_mode(mode: string) - Switch studio mode.
2. update_prompt(text: string) - Write text into the prompt box.
3. generate_image(prompt: string, style?: string, width?: number, height?: number, sourceImages?: string[], referenceAssetIndex?: number, uploadedImageIndex?: number) - Generate images.
4. update_uploaded_image_metadata(uploadedImageIndex: number, category?: string, tags?: string[], subject?: string) - Update metadata for an uploaded image.
5. read_history() - Read recent chat history.
6. batch_edit_images(prompt: string, imageIndices?: number[]) - Edit uploaded images with an instruction.
7. batch_edit_videos(prompt: string, videoIndices?: number[]) - Edit/Grade uploaded videos with an instruction.
8. create_project(name: string, type: string) - Create a new project.
9. list_projects() - List all projects.
10. search_knowledge(query: string) - Search the knowledge base.
11. open_project(projectId: string) - Open a specific project.
12. delegate_task(targetAgentId: string, task: string) - Delegate to specialized agent. VALID AGENT IDs: ${VALID_AGENT_IDS_LIST}. Using any other ID will fail.
13. generate_video(prompt: string, image?: string, duration?: number) - Generate video.
14. generate_motion_brush(image: string, mask: string, prompt?: string) - Motion brush animation.
15. analyze_audio(audio: string) - Analyze audio file.
16. analyze_contract(file_data: string, mime_type: string) - Analyze contract.
17. generate_social_post(platform: string, topic: string, tone: string) - Generate social post.
18. save_memory(content: string, type: string, confidence: number) - Save a fact or rule to long-term memory.
19. recall_memories(query: string) - Search long-term memory.
20. verify_output(goal: string, content: string) - Critique generated content.
21. request_approval(content: string) - Pause and ask user for approval.
22. write_press_release(topic: string, angle?: string, quotes?: string[]) - Write a press release.
23. generate_crisis_response(scenario: string, stakeholders: string[]) - Generate crisis response.
24. pitch_story(outlet: string, hook: string) - Write a pitch email.
25. extend_video(videoUrl: string, direction: string, frame: number) - Extend video (direction: 'forwards' or 'backwards').
26. update_keyframe(clipId: string, property: string, frame: number, value: number, easing: string) - Add or update a keyframe.
27. list_organizations() - List all organizations.
28. switch_organization(orgId: string) - Switch to a different organization.
29. create_organization(name: string) - Create a new organization.
30. get_organization_details() - Get details of current organization.
31. list_files(limit?: number, type?: string) - List recently generated files.
32. search_files(query: string, type?: string) - Search files by name or type.
33. search_places(query: string, type?: string) - Search for real-world places (venues, hotels) via Google Maps.
34. get_place_details(place_id: string) - Get address, phone, and reviews for a specific place.
35. get_distance_matrix(origins: string[], destinations: string[]) - Calculate travel time and distance between locations.
36. analyze_brand_consistency(content: string, brand_guidelines?: string) - Analyze brand consistency.
37. generate_brand_guidelines(name: string, values: string[]) - Generate brand guidelines.
38. audit_visual_assets(assets: string[]) - Audit visual assets.
39. create_campaign_brief(product: string, goal: string, budget?: string, duration?: string) - Create marketing campaign brief.
40. analyze_audience(genre: string, similar_artists?: string[]) - Analyze target audience.
41. schedule_content(campaign_start: string, platforms: string[], frequency: string) - Create content calendar.
42. track_performance(campaignId: string) - Track marketing performance.
43. plan_tour_route(locations?: string[], start_location?: string, end_location?: string, stops?: string[], timeframe?: string) - Plan tour route.
44. calculate_tour_budget(days?: number, crew?: number, crew_size?: number, duration_days?: number, accommodation_level?: string) - Calculate tour budget.
45. generate_itinerary(route?: any, city?: string, date?: string, venue?: string, show_time?: string) - Generate daily itinerary.
46. audit_permissions(project_id?: string) - Audit security permissions.
47. scan_for_vulnerabilities(scope: string) - Scan for vulnerabilities.
48. check_api_status(api_name: string) - Check API status.
49. scan_content(text: string) - Scan content for sensitive data.
50. rotate_credentials(service_name: string) - Rotate credentials.
51. verify_zero_touch_prod(service_name: string) - Verify zero-touch prod.
`;
