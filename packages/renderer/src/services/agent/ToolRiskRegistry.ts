import type { ToolRiskTier, ToolRiskMetadata } from './types';

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
export const TOOL_RISK_REGISTRY: Record<string, ToolRiskMetadata> = {

    // =========================================================================
    // READ — No side effects, safe to auto-approve
    // =========================================================================

    // Core / Navigation
    read_history: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    list_projects: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    list_organizations: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    list_files: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    search_files: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    search_knowledge: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_organization_details: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_studio_assets: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_user_context: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    list_user_memories: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_user_memory_analytics: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    check_calendar_notifications: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Memory & Knowledge (read)
    recall_memories: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    search_user_memory: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Security (read)
    check_api_status: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    scan_content: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    verify_zero_touch_prod: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    check_core_dump_policy: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    audit_workload_isolation: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    audit_permissions: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    generate_security_report: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Maps (read)
    search_places: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_place_details: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_distance_matrix: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Analytics (read)
    execute_bigquery_query: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_table_schema: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    list_datasets: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    run_cohort_analysis: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Browser (read)
    browser_navigate: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    browser_snapshot: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Distribution (read)
    list_timeline_templates: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    list_timelines: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    get_timeline_status: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Music (read)
    verify_metadata_golden: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    verify_mechanical_license: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    query_pro_database: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Brand & Marketing (read)
    analyze_brand_consistency: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    audit_visual_assets: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    analyze_audience: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    track_performance: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },
    analyze_script_structure: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Production (read)
    breakdown_script: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // Finance (read — analysis tools)
    analyze_audio: { riskTier: 'read', permissionTier: 'builtin', requiresApproval: false, description: 'Read-only operation' },

    // =========================================================================
    // WRITE — Creates/mutates data, default tier
    // =========================================================================

    // Core / Navigation
    set_mode: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    update_prompt: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    delegate_task: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    request_approval: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    agent_negotiate: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    initiate_voice_conversation: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    sync_daw_vision: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    run_final_polish_strike: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Creative
    generate_image: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    batch_edit_images: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    batch_edit_videos: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    update_uploaded_image_metadata: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_video: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_motion_brush: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    extend_video: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    update_keyframe: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Project
    create_project: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    open_project: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    switch_organization: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    create_organization: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Memory
    save_memory: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    save_user_memory: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    update_user_memory: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    consolidate_user_memories: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Social & Marketing
    generate_social_post: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    schedule_content: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    create_campaign_brief: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Brand
    generate_brand_guidelines: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Road Management
    plan_tour_route: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    calculate_tour_budget: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_itinerary: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Publicist
    write_press_release: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_crisis_response: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Timelines
    create_timeline: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    activate_timeline: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    pause_timeline: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    resume_timeline: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    advance_phase: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    adjust_cadence: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Licensing & Legal
    match_sync_licensing_brief: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_beat_lease_contract: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    draft_contract: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_nda: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_split_sheet: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_dmca_takedown: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Music & Publishing
    create_music_metadata: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    update_track_metadata: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    scrub_id3_tags: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    inject_splits_to_metadata: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    export_dolby_atmos_stems: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Production & Narrative
    create_call_sheet: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    generate_visual_script: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    format_screenplay: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Commerce
    mockup_merchandise: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    recommend_merch_pricing: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    create_limited_drop_campaign: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Web3
    generate_token_gated_preview: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Security (write — logging and watermarking)
    log_audit_event: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    apply_watermark: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },
    require_biometric_auth: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Browser (write — actions)
    browser_action: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // Verification
    verify_output: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Standard write operation' },

    // =========================================================================
    // DESTRUCTIVE — Irreversible, requires explicit user approval
    // =========================================================================

    // Security
    rotate_credentials: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },
    scan_for_vulnerabilities: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },

    // Memory (destructive)
    deactivate_user_memory: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },
    delete_user_memory: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },

    // Commerce & Web3 (destructive — financial/blockchain impact)
    create_artifact_drop: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },
    deploy_storefront_preview: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },
    generate_smart_contract: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },
    trace_blockchain_royalty: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },

    // Legal (destructive — initiates legal processes)
    trigger_digital_signature: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Destructive operation requiring explicit user approval' },

    // Code Execution (destructive — runs arbitrary code on host)
    execute_code: { riskTier: 'destructive', permissionTier: 'plugin', requiresApproval: true, description: 'Executes arbitrary Python code via the sidecar — requires explicit user approval' },

    // =========================================================================
    // WRITE — OpenClaw Gap Tools
    // =========================================================================

    // Canvas A2UI (write — pushes UI content, no destructive side effects)
    canvas_push: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Push visual content to user workspace' },
    canvas_clear: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Clear agent canvas panels' },

    // Notifications (write — sends alerts to the user)
    send_notification: { riskTier: 'write', permissionTier: 'core', requiresApproval: false, description: 'Send notification to user outside app' },
};

/**
 * Get the risk tier for a tool by name.
 * Returns the classified tier, or 'write' as the default if not explicitly mapped.
 */
export function getToolRiskMetadata(toolName: string): ToolRiskMetadata {
    return TOOL_RISK_REGISTRY[toolName] ?? {
        riskTier: 'write',
        permissionTier: 'plugin',
        requiresApproval: true,
        description: 'Unknown tool implicitly treated as high-risk plugin'
    };
}

export function getToolRiskTier(toolName: string): ToolRiskTier {
    return getToolRiskMetadata(toolName).riskTier;
}