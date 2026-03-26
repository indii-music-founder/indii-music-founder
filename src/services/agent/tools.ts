import { PUBLICIST_TOOLS } from '@/modules/publicist/tools';
import { CREATIVE_TOOLS } from '@/modules/creative/tools';
import { DirectorTools } from './tools/DirectorTools';
import { VideoTools } from './tools/VideoTools';
import { MemoryTools } from './tools/MemoryTools';
import { UserMemoryTools } from './tools/UserMemoryTools';
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
import { DistributionTools } from './tools/DistributionTools';
import { UniversalTools } from './tools/UniversalTools';
import { TimelineTools } from './tools/TimelineTools';
// Previously unregistered tool modules
import { LicensingTools } from './tools/LicensingTools';
import { LegalTools } from './tools/LegalTools';
import { MusicTools } from './tools/MusicTools';
import { PublishingTools } from './tools/PublishingTools';
import { ProducerTools } from './tools/ProducerTools';
import { NarrativeTools } from './tools/NarrativeTools';
import { ScreenwriterTools } from './tools/ScreenwriterTools';
import { SovereignTools } from './tools/SovereignTools';
import { CommerceTools } from './tools/CommerceTools';
import { BigQueryTools } from './tools/BigQueryTools';
import { BrowserTools } from './tools/BrowserTools';
import { Web3Tools } from './tools/Web3Tools';
import { CoreVaultTools } from './tools/CoreVaultTools';
import { CaptainsLogTools } from './tools/CaptainsLogTools';
import { SqueezerTools } from './tools/SqueezerTools';
import { HiveTools } from './tools/HiveTools';
import { AnyToolFunction, VALID_AGENT_IDS_LIST } from './types';

export const TOOL_REGISTRY: Record<string, AnyToolFunction> = {
    ...CoreTools,
    ...UniversalTools,
    ...DirectorTools,
    ...VideoTools,
    ...CREATIVE_TOOLS,
    ...MemoryTools,
    ...UserMemoryTools,
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
    ...PUBLICIST_TOOLS,
    ...FinanceTools,
    ...DistributionTools,
    ...TimelineTools,
    // Domain specialists
    ...LicensingTools,
    ...LegalTools,
    ...MusicTools,
    ...PublishingTools,
    ...ProducerTools,
    ...NarrativeTools,
    ...ScreenwriterTools,
    ...SovereignTools,
    ...CommerceTools,
    ...BigQueryTools,
    ...BrowserTools,
    ...Web3Tools,
    // Memory Architecture Layer 3 & 4
    ...CoreVaultTools,
    ...CaptainsLogTools,
    // Memory Architecture Layer 1 & 2
    ...SqueezerTools,
    ...HiveTools,
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
12. delegate_task(targetAgentId: string, task: string) - Delegate to specialized agent. VALID AGENT IDs: ${VALID_AGENT_IDS_LIST}. Using any other ID will fail.
13. generate_video(prompt: string, image?: string, duration?: number) - Generate video.
14. generate_motion_brush(image: string, mask: string, prompt?: string) - Motion brush animation.
15. analyze_audio(audio: string) - Analyze audio file.
16. get_studio_assets(query?: string, limit?: number, type?: 'image'|'video') - Search and retrieve specific assets from the Creative Studio history.
16. analyze_contract(file_data: string, mime_type: string) - Analyze contract.
17. generate_social_post(platform: string, topic: string, tone: string) - Generate social post.
18. save_memory(content: string, type: string, confidence: number) - Save a fact or rule to long-term memory.
19. recall_memories(query: string) - Search long-term memory.
20. verify_output(goal: string, content: string) - Critique generated content.
21. request_approval(content: string) - Pause and ask user for approval.
22. write_press_release(headline: string, company_name: string, key_points: string[], contact_info: string) - Write a press release.
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
35. analyze_brand_consistency(content: string, type: string) - Analyze brand consistency.
36. generate_brand_guidelines(name: string, values: string[]) - Generate brand guidelines.
37. audit_visual_assets(assets: string[]) - Audit visual assets.
38. create_campaign_brief(product: string, goal: string) - Create marketing campaign brief.
39. analyze_audience(platform: string) - Analyze target audience.
40. schedule_content(posts: any[]) - Create content schedule.
41. plan_tour_route(locations?: string[], start_location?: string, end_location?: string, stops?: string[], timeframe?: string) - Plan tour route.
42. calculate_tour_budget(days?: number, crew?: number, crew_size?: number, duration_days?: number, accommodation_level?: string) - Calculate tour budget.
43. generate_itinerary(route?: any, city?: string, date?: string, venue?: string, show_time?: string) - Generate daily itinerary.
44. audit_permissions(project_id?: string) - Audit security permissions.
45. scan_for_vulnerabilities(scope: string) - Scan for vulnerabilities.
46. track_performance(campaignId: string) - Track campaign performance.
47. check_api_status(api_name: string) - Check API status.
48. scan_content(text: string) - Scan content for sensitive data.
49. rotate_credentials(service_name: string) - Rotate credentials.
50. verify_zero_touch_prod(service_name: string) - Verify zero-touch prod.
51. save_user_memory(content: string, category?: string, importance?: string, tags?: string[]) - Save to user's persistent memory across all sessions.
52. search_user_memory(query: string, categories?: string[], importance?: string[], tags?: string[], limit?: number) - Search user's persistent memory semantically.
53. get_user_context() - Get aggregated user context summary (preferences, goals, key facts).
54. list_user_memories(categories?: string[], isActive?: boolean, limit?: number) - List user memories with filtering.
55. update_user_memory(memoryId: string, content?: string, category?: string, importance?: string, tags?: string[], isActive?: boolean) - Update existing user memory.
56. deactivate_user_memory(memoryId: string) - Deactivate a user memory (soft delete).
57. delete_user_memory(memoryId: string) - Permanently delete a user memory.
58. get_user_memory_analytics(days?: number) - Get analytics about user memories.
59. consolidate_user_memories() - Consolidate user memories to reduce redundancy.
60. create_timeline(goal, domain, durationWeeks, startDate, templateId?, platforms?, assetStrategy?) - Create a progressive multi-phase campaign timeline.
61. list_timelines(status?) - List all progressive campaign timelines.
62. get_timeline_status(timelineId) - Get detailed timeline progress.
63. activate_timeline(timelineId) - Activate a draft timeline.
64. pause_timeline(timelineId) - Pause an active timeline.
65. resume_timeline(timelineId) - Resume a paused timeline.
66. advance_phase(timelineId) - Skip to the next phase.
67. adjust_cadence(timelineId, phaseId, cadence) - Change posting frequency mid-campaign.
68. list_timeline_templates() - List available progressive campaign templates.
--- LICENSING & LEGAL ---
69. match_sync_licensing_brief(briefDescription: string, mood: string, targetBpm: number) - Match catalog tracks to a sync licensing brief using mood/BPM scoring.
70. generate_beat_lease_contract(beatTitle, producerName, buyerName, leaseType, price) - Generate a beat lease agreement (Exclusive or Non-Exclusive).
71. draft_contract(type, parties, terms) - Draft a general music industry contract.
72. generate_nda(partyA, partyB, purpose, duration) - Generate a Non-Disclosure Agreement.
73. generate_split_sheet(trackTitle, collaborators) - Generate a royalty split sheet.
74. trigger_digital_signature(documentUrl, signers) - Initiate digital signature workflow.
75. generate_dmca_takedown(infringingUrl, contentDescription, ownerName) - Generate a DMCA takedown notice.
76. verify_mechanical_license(isrc, territory) - Verify mechanical license coverage for a track.
--- MUSIC & PUBLISHING ---
77. create_music_metadata(trackTitle, artistName, genre, bpm, key, mood, isrc) - Create standardized music metadata.
78. verify_metadata_golden(trackId) - Verify metadata completeness against golden standard.
79. update_track_metadata(trackId, updates) - Update track metadata fields.
80. scrub_id3_tags(fileUrl) - Scrub and standardize ID3 tags on an audio file.
81. inject_splits_to_metadata(trackId, splits) - Inject royalty split data into track metadata.
82. export_dolby_atmos_stems(trackId, format) - Export stems for Dolby Atmos spatial audio.
83. query_pro_database(songTitle, composer, pro) - Query a Performing Rights Organization database.
--- PRODUCTION & NARRATIVE ---
84. create_call_sheet(projectName, date, location, crew, talent) - Create a production call sheet.
85. breakdown_script(scriptText) - Break down a script into production elements.
86. generate_visual_script(concept, scenes, style) - Generate a visual narrative script.
87. format_screenplay(storyOutline, genre) - Format a screenplay from an outline.
88. analyze_script_structure(scriptText) - Analyze script structure and pacing.
--- COMMERCE & WEB3 ---
89. create_artifact_drop(assetId, dropType, price, quantity) - Create a sovereign artifact drop (NFT or limited edition).
90. mockup_merchandise(productType, designUrl, colorway) - Generate merchandise mockups.
91. deploy_storefront_preview(products) - Deploy a storefront preview for fan review.
92. recommend_merch_pricing(productType, cost, targetMargin) - Recommend merchandise pricing based on market data.
93. create_limited_drop_campaign(productId, dropDate, quantity, notifyFans) - Create a limited drop campaign.
94. generate_smart_contract(type, parties, terms) - Generate a Web3 smart contract (ERC-721 / ERC-1155).
95. trace_blockchain_royalty(tokenId, chain) - Trace on-chain royalty history for a token.
96. generate_token_gated_preview(assetId, tokenContract) - Generate a token-gated content preview URL.
--- ANALYTICS & BROWSER ---
97. execute_bigquery_query(sql, projectId) - Execute a BigQuery SQL query for revenue analytics.
98. get_table_schema(dataset, table) - Get BigQuery table schema.
99. list_datasets(projectId) - List available BigQuery datasets.
100. run_cohort_analysis(metric, cohortType, dateRange) - Run a user/fan cohort analysis.
101. browser_navigate(url) - Navigate to a URL in the background browser.
102. browser_action(action, selector, value) - Perform a browser action (click, type, select).
103. browser_snapshot(format) - Take a snapshot of the current browser page.
`;
