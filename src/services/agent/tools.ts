
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
// DISABLED: Mock implementations - not production ready (returns fake data)
// Re-enable when real GCP SDK integrations are implemented
// import { execute_bigquery_query, get_table_schema } from './tools/BigQueryTools';
// import { list_clusters, get_cluster_status, scale_deployment, list_instances, restart_service } from './tools/DevOpsTools';
// import { check_api_status, scan_content, rotate_credentials, verify_zero_touch_prod, check_core_dump_policy, audit_workload_isolation } from './tools/SecurityTools';

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
    // DISABLED: Mock tools removed from registry
    // execute_bigquery_query,
    // get_table_schema,
    // list_clusters,
    // get_cluster_status,
    // scale_deployment,
    // list_instances,
    // restart_service,
    // check_api_status,
    // scan_content,
    // rotate_credentials,
    // verify_zero_touch_prod,
    // check_core_dump_policy,
    // audit_workload_isolation,
    ...PUBLICIST_TOOLS
};

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
12. delegate_task(agent_id: string, task: string, context?: any) - Delegate to specialized agent.
13. generate_video(prompt: string, image?: string, duration?: number) - Generate video.
14. generate_motion_brush(image: string, mask: string, prompt?: string) - Motion brush animation.
15. analyze_audio(audio: string) - Analyze audio file.
16. analyze_contract(file_data: string, mime_type: string) - Analyze contract.
17. generate_social_post(platform: string, topic: string, tone: string) - Generate social post.
18. save_memory(content: string, type: string, confidence: number) - Save a fact or rule to long-term memory.
19. recall_memories(query: string) - Search long-term memory.
20. verify_output(goal: string, content: string) - Critique generated content.
21. request_approval(content: string) - Pause and ask user for approval.
22. write_press_release(headline: string, company_name: string, key_points: string, contact_info: string) - Write a press release.
23. generate_crisis_response(issue: string, sentiment: string, platform: string) - Generate crisis response.
24. extend_video(videoUrl: string, direction: string, frame: number) - Extend video (direction: 'forwards' or 'backwards').
25. update_keyframe(clipId: string, property: string, frame: number, value: number, easing: string) - Add or update a keyframe.
26. list_organizations() - List all organizations.
27. switch_organization(orgId: string) - Switch to a different organization.
28. create_organization(name: string) - Create a new organization.
29. get_organization_details() - Get details of current organization.
30. list_files(limit?: number, type?: string) - List recently generated files.
31. search_files(query: string, type?: string) - Search files by name or type.
32. search_places(query: string, type?: string) - Search for real-world places (venues, hotels) via Google Maps.
33. get_place_details(place_id: string) - Get address, phone, and reviews for a specific place.
34. get_distance_matrix(origins: string[], destinations: string[]) - Calculate travel time and distance between locations.
`;
