/**
 * packages/renderer/src/services/agent/skills/ProductSkillRegistry.ts
 *
 * Hermetic Product Skill Runtime Registry for indii.music.
 *
 * Packages all 27 Conductor domain playbooks (agents/conductor/skills/* /SKILL.md)
 * directly into the client-side production JavaScript bundle at build time via
 * Vite's import.meta.glob with raw string queries.
 *
 * This guarantees:
 * 1. Zero disk or file system access at runtime (safe for web browser & packaged Electron asar).
 * 2. Complete offline availability for studio operations.
 * 3. Strict schema adherence to the open Agent Skills standard (agentskills.io):
 *    - name, description, user-invocable, disable-model-invocation, allowed-tools, argument-hint.
 * 4. Context injection into Conductor agents and slash command dispatch.
 */

import { judgeSkillIntent } from '@/config/typesafeJudgments';

export interface ProductSkill {
    /** Canonical skill identifier, typically matching the directory name (e.g. 'digital_distribution') */
    id: string;
    /** Human-readable skill name */
    name: string;
    /** Descriptive summary of domain expertise and tasks */
    description: string;
    /** Whether users can invoke this skill via slash commands (defaults to true) */
    userInvocable: boolean;
    /** Whether autonomous model invocation is blocked without human confirmation (defaults to false) */
    disableModelInvocation: boolean;
    /** Optional array of tool names explicitly authorized for this skill */
    allowedTools?: string[];
    /** Optional user argument hint (e.g. "<isrc_code> <release_date>") */
    argumentHint?: string;
    /** Semantic triggers, aliases, and keywords used for auto-routing */
    triggerLabels: string[];
    /** Markdown playbook body excluding frontmatter */
    body: string;
    /** Complete original markdown text */
    rawContent: string;
}

// Module ID to Skill ID mapping for automatic skill resolution
const MODULE_TO_SKILL_MAP: Record<string, string> = {
    'distribution': 'digital_distribution',
    'legal': 'legal_affairs',
    'creative': 'creative_direction',
    'marketing': 'music_marketing',
    'finance': 'finance_royalties',
    'brand': 'brand_manager',
    'publishing': 'publishing',
    'licensing': 'licensing',
    'social': 'social_media',
    'road': 'tour_management',
    'merch': 'merchandising',
    'publicist': 'public_relations',
    'workflow': 'workflow_builder',
    'knowledge': 'knowledge_base',
    'history': 'history_manager',
    'notes': 'knowledge_base',
    'crm': 'fan_engagement',
    'campaign': 'release_strategy',
    'raw-converter': 'audio_engineering',
    'project-canvas': 'creative_direction',
};

// Agent ID to Skill ID mapping
const AGENT_TO_SKILL_MAP: Record<string, string> = {
    'distribution': 'digital_distribution',
    'legal': 'legal_affairs',
    'creative': 'creative_direction',
    'marketing': 'music_marketing',
    'finance': 'finance_royalties',
    'brand': 'brand_manager',
    'publishing': 'publishing',
    'licensing': 'licensing',
    'social': 'social_media',
    'road': 'tour_management',
    'merchandise': 'merchandising',
    'publicist': 'public_relations',
    'music': 'audio_engineering',
    'director': 'video_producer',
    'screenwriter': 'creative_direction',
    'producer': 'audio_engineering',
    'video': 'video_producer',
};

/**
 * Parses YAML frontmatter from a SKILL.md document without requiring external YAML libraries.
 */
function parseSkillDocument(id: string, rawContent: string): ProductSkill {
    let name = id;
    let description = '';
    let userInvocable = true;
    let disableModelInvocation = false;
    let allowedTools: string[] | undefined = undefined;
    let argumentHint: string | undefined = undefined;
    const triggerLabels: string[] = [];
    let body = rawContent;

    const trimmed = rawContent.trimStart();
    if (trimmed.startsWith('---')) {
        const endFrontmatterIndex = trimmed.indexOf('---', 3);
        if (endFrontmatterIndex !== -1) {
            const frontmatterText = trimmed.substring(3, endFrontmatterIndex).trim();
            body = trimmed.substring(endFrontmatterIndex + 3).trim();

            const lines = frontmatterText.split(/\r?\n/);
            let currentKey = '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('#')) continue;

                // Check for list items
                if (trimmedLine.startsWith('- ') && currentKey) {
                    const item = trimmedLine.substring(2).trim().replace(/^['"]|['"]$/g, '');
                    if (currentKey === 'trigger_labels' || currentKey === 'trigger-labels' || currentKey === 'triggers') {
                        triggerLabels.push(item);
                    } else if (currentKey === 'allowed_tools' || currentKey === 'allowed-tools') {
                        if (!allowedTools) allowedTools = [];
                        allowedTools.push(item);
                    }
                    continue;
                }

                // Check for key-value pair
                const colonIdx = line.indexOf(':');
                if (colonIdx !== -1) {
                    const key = line.substring(0, colonIdx).trim().toLowerCase();
                    const rawVal = line.substring(colonIdx + 1).trim();
                    const val = rawVal.replace(/^['"]|['"]$/g, '');
                    currentKey = key;

                    switch (key) {
                        case 'name':
                            if (val) name = val;
                            break;
                        case 'description':
                            if (val) description = val;
                            break;
                        case 'user-invocable':
                        case 'user_invocable':
                            userInvocable = val !== 'false';
                            break;
                        case 'disable-model-invocation':
                        case 'disable_model_invocation':
                            disableModelInvocation = val === 'true';
                            break;
                        case 'argument-hint':
                        case 'argument_hint':
                            if (val) argumentHint = val;
                            break;
                        case 'allowed-tools':
                        case 'allowed_tools':
                            if (val) {
                                allowedTools = val.split(/[,;\s]+/).map(t => t.trim()).filter(Boolean);
                            }
                            break;
                        case 'trigger_labels':
                        case 'trigger-labels':
                        case 'triggers':
                            if (val) {
                                val.split(/[,;]+/).forEach(t => {
                                    const cleaned = t.trim();
                                    if (cleaned) triggerLabels.push(cleaned);
                                });
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
        }
    }

    // Fallback: If no description was extracted from frontmatter, inspect first markdown paragraph
    if (!description) {
        const paragraphs = body.split(/\r?\n\r?\n/);
        for (const p of paragraphs) {
            const clean = p.trim();
            if (clean && !clean.startsWith('#')) {
                description = clean.replace(/[*_`]/g, '').slice(0, 240);
                break;
            }
        }
        if (!description) {
            description = `Conductor playbook for ${name.replace(/_/g, ' ')}`;
        }
    }

    // Always ensure the id and name are in trigger labels
    if (!triggerLabels.includes(id)) {
        triggerLabels.push(id);
    }
    const normalizedName = name.toLowerCase().replace(/\s+/g, '_');
    if (!triggerLabels.includes(normalizedName)) {
        triggerLabels.push(normalizedName);
    }

    return {
        id,
        name,
        description,
        userInvocable,
        disableModelInvocation,
        allowedTools,
        argumentHint,
        triggerLabels,
        body,
        rawContent
    };
}

class ProductSkillRegistryImpl {
    private skills: Map<string, ProductSkill> = new Map();
    private initialized = false;

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        if (this.initialized) return;

        try {
            // Eagerly glob all 27 Conductor SKILL.md files at build time as raw strings
            // Root-relative path in Vite workspace: /agents/conductor/skills/*/SKILL.md
            const skillModules = import.meta.glob<string>(
                '/agents/conductor/skills/*/SKILL.md',
                { query: '?raw', eager: true, import: 'default' }
            );

            for (const [filePath, rawModule] of Object.entries(skillModules)) {
                const normalizedPath = filePath.replace(/\\/g, '/');
                const match = normalizedPath.match(/conductor\/skills\/([^/]+)\/SKILL\.md$/i);
                if (!match || !match[1]) continue;

                const skillId = match[1];
                const content = typeof rawModule === 'string'
                    ? rawModule
                    : (rawModule as { default?: string })?.default || '';

                if (content) {
                    const skill = parseSkillDocument(skillId, content);
                    this.skills.set(skill.id, skill);
                    // Also key by lowercase name if distinct
                    const lowerName = skill.name.toLowerCase();
                    if (lowerName !== skill.id) {
                        this.skills.set(lowerName, skill);
                    }
                }
            }
        } catch (err) {
            // Handle testing or non-Vite environments gracefully
            console.warn('[ProductSkillRegistry] Failed to initialize skills via import.meta.glob:', err);
        }

        this.initialized = true;
    }

    /**
     * Manually registers a product skill (useful for testing or dynamic extension).
     */
    public registerSkill(skill: ProductSkill): void {
        this.skills.set(skill.id, skill);
        this.skills.set(skill.name.toLowerCase(), skill);
    }

    /**
     * Retrieves a skill by ID or name (case-insensitive).
     */
    public getProductSkill(idOrName: string): ProductSkill | undefined {
        if (!idOrName) return undefined;
        const normalized = idOrName.trim().toLowerCase().replace(/^[/\\]+/, '');
        return this.skills.get(normalized) || Array.from(this.skills.values()).find(
            s => s.id.toLowerCase() === normalized || s.name.toLowerCase() === normalized
        );
    }

    /**
     * Returns all registered product skills.
     */
    public getAllProductSkills(): ProductSkill[] {
        // Return deduplicated values
        return Array.from(new Set(this.skills.values()));
    }

    /**
     * Retrieves the associated product skill for an active UI module.
     */
    public getSkillForModule(moduleId: string): ProductSkill | undefined {
        if (!moduleId) return undefined;
        const skillId = MODULE_TO_SKILL_MAP[moduleId] || moduleId;
        return this.getProductSkill(skillId);
    }

    /**
     * Retrieves the associated product skill for an active agent ID.
     */
    public getSkillForAgent(agentId: string): ProductSkill | undefined {
        if (!agentId) return undefined;
        const skillId = AGENT_TO_SKILL_MAP[agentId] || agentId;
        return this.getProductSkill(skillId);
    }

    /**
     * Searches for the most relevant product skill matching a user prompt or search query.
     */
    public searchProductSkillByIntent(query: string): ProductSkill | undefined {
        if (!query || typeof query !== 'string') return undefined;

        const normalizedQuery = query.toLowerCase().trim();

        // 1. Direct slash command match (e.g. "/digital_distribution" or "/distribution")
        if (normalizedQuery.startsWith('/')) {
            const command = normalizedQuery.split(/\s+/)[0]?.substring(1);
            if (command) {
                const direct = this.getProductSkill(command);
                if (direct) return direct;
            }
        }

        // 2. Exact word boundary match on trigger labels
        for (const skill of this.getAllProductSkills()) {
            for (const trigger of skill.triggerLabels) {
                const regex = new RegExp(`\\b${trigger.toLowerCase()}\\b`, 'i');
                if (regex.test(normalizedQuery)) {
                    return skill;
                }
            }
        }

        // 3. Match in title/id
        for (const skill of this.getAllProductSkills()) {
            const skillName = skill.name.toLowerCase().replace(/_/g, ' ');
            if (normalizedQuery.includes(skillName) || normalizedQuery.includes(skill.id.replace(/_/g, ' '))) {
                return skill;
            }
        }

        // 4. Keyword search against description and metadata (excluding stop words)
        const STOP_WORDS = new Set(['skill', 'skills', 'playbook', 'agent', 'help', 'with', 'from', 'that', 'this', 'what', 'when', 'where', 'which', 'about', 'need', 'the', 'and', 'for']);
        const queryWords = normalizedQuery
            .split(/[^a-zA-Z0-9]+/)
            .filter(w => w.length >= 4 && !STOP_WORDS.has(w));

        let bestMatch: ProductSkill | undefined = undefined;
        let maxMatches = 0;

        for (const skill of this.getAllProductSkills()) {
            const searchableText = `${skill.name} ${skill.id} ${skill.description}`.toLowerCase();
            let matches = 0;
            for (const word of queryWords) {
                if (searchableText.includes(word)) {
                    matches++;
                }
            }
            if (matches > maxMatches) {
                maxMatches = matches;
                bestMatch = skill;
            }
        }

        if (maxMatches > 0) {
            return bestMatch;
        }

        return undefined;
    }

    /**
     * Async variant: deterministic matchers first (identical to
     * {@link searchProductSkillByIntent}); on a total miss, a TypeSafe Choice
     * judgment picks the best-skilling candidate (or none) when the
     * enable_typesafe_judgments flag is on (ISSUE-1442 pilot).
     */
    public async searchProductSkillByIntentAsync(query: string): Promise<ProductSkill | undefined> {
        const deterministic = this.searchProductSkillByIntent(query);
        if (deterministic) return deterministic;

        const candidates = this.getAllProductSkills().map(s => ({
            id: s.id, name: s.name, description: s.description,
        }));
        const judgedId = await judgeSkillIntent(query, candidates);
        return judgedId ? this.getProductSkill(judgedId) : undefined;
    }

    /**
     * Formats a product skill into an XML context block for LLM prompt injection.
     */
    public formatSkillForPrompt(skill: ProductSkill): string {
        return `
<active_product_skill id="${skill.id}" name="${skill.name}">
<description>${skill.description}</description>
${skill.argumentHint ? `<argument_hint>${skill.argumentHint}</argument_hint>` : ''}
${skill.allowedTools && skill.allowedTools.length > 0 ? `<allowed_tools>${skill.allowedTools.join(', ')}</allowed_tools>` : ''}
<playbook>
${skill.body}
</playbook>
</active_product_skill>
`.trim();
    }
}

export const ProductSkillRegistry = new ProductSkillRegistryImpl();
export { parseSkillDocument };
