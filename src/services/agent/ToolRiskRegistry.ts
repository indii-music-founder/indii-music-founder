import type { ToolRiskTier } from './types';

/**
 * ToolRiskRegistry — Centralized risk classification for all agent tools.
 *
 * Agentic Harness Primitive #2: Tiered Permission System
 *
 * Instead of modifying every individual tool declaration file,
 * this registry provides a single source of truth for risk metadata.
 * DigitalHandshake reads from this registry at runtime to determine
 * whether a tool invocation requires user approval.
 *
 * Classification rules:
 * - 'read': No side effects. Query, list, search, get, recall, check, read.
 * - 'write': Creates or mutates data. Create, save, update, generate, set, inject, export.
 * - 'destructive': Irreversible or high-impact. Delete, rotate, deploy, trigger_signature.
 *
 * Tools not listed default to 'write' at runtime.
 */
export const TOOL_RISK_REGISTRY: Record<string, ToolRiskTier> = {

    // =========================================================================
    // READ — No side effects, safe to auto-approve
    // =========================================================================

    // Core / Navigation
    read_history: 'read',
    list_projects: 'read',
    list_organizations: 'read',
    list_files: 'read',
    search_files: 'read',
    search_knowledge: 'read',
    get_organization_details: 'read',
    get_studio_assets: 'read',
    get_user_context: 'read',
    list_user_memories: 'read',
    get_user_memory_analytics: 'read',
    check_calendar_notifications: 'read',

    // Memory & Knowledge (read)
    recall_memories: 'read',
    search_user_memory: 'read',

    // Security (read)
    check_api_status: 'read',
    scan_content: 'read',
    verify_zero_touch_prod: 'read',
    check_core_dump_policy: 'read',
    audit_workload_isolation: 'read',
    audit_permissions: 'read',
    generate_security_report: 'read',

    // Maps (read)
    search_places: 'read',
    get_place_details: 'read',
    get_distance_matrix: 'read',

    // Analytics (read)
    execute_bigquery_query: 'read',
    get_table_schema: 'read',
    list_datasets: 'read',
    run_cohort_analysis: 'read',

    // Browser (read)
    browser_navigate: 'read',
    browser_snapshot: 'read',

    // Distribution (read)
    list_timeline_templates: 'read',
    list_timelines: 'read',
    get_timeline_status: 'read',

    // Music (read)
    verify_metadata_golden: 'read',
    verify_mechanical_license: 'read',
    query_pro_database: 'read',

    // Brand & Marketing (read)
    analyze_brand_consistency: 'read',
    audit_visual_assets: 'read',
    analyze_audience: 'read',
    track_performance: 'read',
    analyze_script_structure: 'read',

    // Production (read)
    breakdown_script: 'read',

    // Finance (read — analysis tools)
    analyze_audio: 'read',

    // =========================================================================
    // WRITE — Creates/mutates data, default tier
    // =========================================================================

    // Core / Navigation
    set_mode: 'write',
    update_prompt: 'write',
    delegate_task: 'write',
    request_approval: 'write',
    agent_negotiate: 'write',
    initiate_voice_conversation: 'write',
    sync_daw_vision: 'write',
    run_final_polish_strike: 'write',

    // Creative
    generate_image: 'write',
    batch_edit_images: 'write',
    batch_edit_videos: 'write',
    update_uploaded_image_metadata: 'write',
    generate_video: 'write',
    generate_motion_brush: 'write',
    extend_video: 'write',
    update_keyframe: 'write',

    // Project
    create_project: 'write',
    open_project: 'write',
    switch_organization: 'write',
    create_organization: 'write',

    // Memory
    save_memory: 'write',
    save_user_memory: 'write',
    update_user_memory: 'write',
    consolidate_user_memories: 'write',

    // Social & Marketing
    generate_social_post: 'write',
    schedule_content: 'write',
    create_campaign_brief: 'write',

    // Brand
    generate_brand_guidelines: 'write',

    // Road Management
    plan_tour_route: 'write',
    calculate_tour_budget: 'write',
    generate_itinerary: 'write',

    // Publicist
    write_press_release: 'write',
    generate_crisis_response: 'write',

    // Timelines
    create_timeline: 'write',
    activate_timeline: 'write',
    pause_timeline: 'write',
    resume_timeline: 'write',
    advance_phase: 'write',
    adjust_cadence: 'write',

    // Licensing & Legal
    match_sync_licensing_brief: 'write',
    generate_beat_lease_contract: 'write',
    draft_contract: 'write',
    generate_nda: 'write',
    generate_split_sheet: 'write',
    generate_dmca_takedown: 'write',

    // Music & Publishing
    create_music_metadata: 'write',
    update_track_metadata: 'write',
    scrub_id3_tags: 'write',
    inject_splits_to_metadata: 'write',
    export_dolby_atmos_stems: 'write',

    // Production & Narrative
    create_call_sheet: 'write',
    generate_visual_script: 'write',
    format_screenplay: 'write',

    // Commerce
    mockup_merchandise: 'write',
    recommend_merch_pricing: 'write',
    create_limited_drop_campaign: 'write',

    // Web3
    generate_token_gated_preview: 'write',

    // Security (write — logging and watermarking)
    log_audit_event: 'write',
    apply_watermark: 'write',
    require_biometric_auth: 'write',

    // Browser (write — actions)
    browser_action: 'write',

    // Verification
    verify_output: 'write',

    // =========================================================================
    // DESTRUCTIVE — Irreversible, requires explicit user approval
    // =========================================================================

    // Security
    rotate_credentials: 'destructive',
    scan_for_vulnerabilities: 'destructive',

    // Memory (destructive)
    deactivate_user_memory: 'destructive',
    delete_user_memory: 'destructive',

    // Commerce & Web3 (destructive — financial/blockchain impact)
    create_artifact_drop: 'destructive',
    deploy_storefront_preview: 'destructive',
    generate_smart_contract: 'destructive',
    trace_blockchain_royalty: 'destructive',

    // Legal (destructive — initiates legal processes)
    trigger_digital_signature: 'destructive',
};

/**
 * Get the risk tier for a tool by name.
 * Returns the classified tier, or 'write' as the default if not explicitly mapped.
 */
export function getToolRiskTier(toolName: string): ToolRiskTier {
    return TOOL_RISK_REGISTRY[toolName] ?? 'write';
}
