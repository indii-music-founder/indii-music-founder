import type { HistoryItem } from '@/core/types/history';

export type CreativeModelTier = 'fast' | 'pro';
export type CreativeEditRoute = 'rapid_edit' | 'typography' | 'heavy_rendering' | 'reference_blend' | 'grounded' | 'canvas_remix';
export type CreativeImageSize = '512' | '1K' | '2K' | '4K';
export type CreativeVaultScope = 'objects' | 'characters' | 'style' | 'masks' | 'outputs';

export interface CreativeEditSettings {
  modelTier: CreativeModelTier;
  resolution: '720p' | '1080p' | '4k';
  imageSize?: CreativeImageSize;
  grounding: boolean;
  aspectRatio: string;
  highFidelity: boolean;
}

export interface CreativeReferenceSlot {
  colorId: string;
  prompt: string;
  hasReferenceImage: boolean;
  role: CreativeVaultScope;
}

export interface CreativeEditManifest {
  sessionId: string;
  projectId: string | null;
  userId?: string;
  itemId: string | null;
  baseImageUri: string | null;
  prompt: string;
  chatHistory: { role: 'user' | 'model'; parts: string }[];
  subjectVault: {
    objects: string[];
    characters: string[];
    style: string[];
  };
  maskUris: string[];
  referenceUris: string[];
  references: CreativeReferenceSlot[];
  generatedCandidates: string[];
  settings: CreativeEditSettings;
  route: {
    id: CreativeEditRoute;
    label: string;
    reason: string;
  };
  source: {
    selectedItemId: string | null;
    projectId: string | null;
    userId?: string;
  };
  timestamps: {
    compiledAt: string;
  };
}

export interface CreativeEditManifestInput {
  sessionId: string;
  projectId: string | null;
  userId?: string;
  item: HistoryItem | null;
  prompt: string;
  definitions: Record<string, string>;
  referenceImages: Record<string, { mimeType: string; data: string } | null>;
  referenceRoles?: Record<string, CreativeVaultScope>;
  referenceAssetUris?: Record<string, string | null>;
  maskUris?: string[];
  generatedCandidates?: Array<{ id: string; url: string; prompt: string }>;
  settings: CreativeEditSettings;
}

export function getCreativeSessionId(itemId: string | null, projectId: string | null): string {
  return `creative_${projectId || 'project'}_${itemId || 'session'}`;
}

export function normalizeCreativeImageSize(size?: string): CreativeImageSize | undefined {
  if (!size) return undefined;
  if (size === '0.5K') return '512';
  if (size === '1k' || size === '1K') return '1K';
  if (size === '2k' || size === '2K') return '2K';
  if (size === '4k' || size === '4K') return '4K';
  if (size === '512' || size === '1K' || size === '2K' || size === '4K') return size;
  return undefined;
}

function inferRoute(
  prompt: string,
  definitions: Record<string, string>,
  referenceCount: number,
  maskCount: number,
  settings: CreativeEditSettings
): CreativeEditManifest['route'] {
  const text = [prompt, ...Object.values(definitions)].join(' ').toLowerCase();
  const isTypography = /(typography|typeface|lettering|logo|infographic|layout|poster|headline|title|caption)/.test(text);
  const isLocalizedEdit = /(replace|remove|fix|inpaint|mask|retouch|cleanup|erase|recolor|speed edit|rapid edit)/.test(text);

  if (isTypography) {
    return {
      id: 'typography',
      label: 'Typography / Layout',
      reason: 'Text-heavy work benefits from Pro-grade rendering.',
    };
  }

  if (referenceCount > 1) {
    return {
      id: 'reference_blend',
      label: 'Reference Blend',
      reason: 'Multiple references are active, so the editor should favor fidelity.',
    };
  }

  if (maskCount > 1) {
    return {
      id: 'rapid_edit',
      label: 'Multi-Mask Edit',
      reason: 'Multiple masks are active, so the editor should stay in the fast edit path.',
    };
  }

  if (settings.grounding) {
    return {
      id: 'grounded',
      label: 'Grounded Search',
      reason: 'Grounding is enabled for real-world context.',
    };
  }

  if (isLocalizedEdit) {
    return {
      id: 'rapid_edit',
      label: 'Rapid Edit',
      reason: 'Localized edit work is routed to the faster path by default.',
    };
  }

  if (settings.highFidelity) {
    return {
      id: 'heavy_rendering',
      label: 'High Fidelity',
      reason: 'High-fidelity mode is enabled.',
    };
  }

  return {
    id: 'canvas_remix',
    label: 'Canvas Remix',
    reason: 'Default creative remix route.',
  };
}

function buildSubjectVault(
  referenceUrisByRole: Record<string, string[]>,
  prompt: string
): CreativeEditManifest['subjectVault'] {
  const lowerPrompt = prompt.toLowerCase();
  const styleHints: string[] = [];
  if (/(neon|cyberpunk|editorial|cinematic|photoreal|oil paint|watercolor|retro|minimal)/.test(lowerPrompt)) {
    styleHints.push(prompt);
  }

  return {
    objects: referenceUrisByRole.objects || [],
    characters: referenceUrisByRole.characters || [],
    style: [...(referenceUrisByRole.style || []), ...styleHints],
  };
}

export function compileCreativeEditManifest(input: CreativeEditManifestInput): CreativeEditManifest {
  const referenceSlots = Object.entries(input.referenceImages).map(([colorId, image]) => ({
    colorId,
    prompt: input.definitions[colorId] || '',
    hasReferenceImage: !!image,
    role: input.referenceRoles?.[colorId] || 'objects',
  }));

  const referenceUrisByRole = {
    objects: Object.entries(input.referenceAssetUris || {})
      .filter(([colorId]) => input.referenceRoles?.[colorId] === 'objects')
      .map(([, uri]) => uri)
      .filter((uri): uri is string => !!uri),
    characters: Object.entries(input.referenceAssetUris || {})
      .filter(([colorId]) => input.referenceRoles?.[colorId] === 'characters')
      .map(([, uri]) => uri)
      .filter((uri): uri is string => !!uri),
    style: Object.entries(input.referenceAssetUris || {})
      .filter(([colorId]) => input.referenceRoles?.[colorId] === 'style')
      .map(([, uri]) => uri)
      .filter((uri): uri is string => !!uri),
  };

  const generatedCandidates = (input.generatedCandidates || []).map(candidate => candidate.url);
  const maskUris = input.maskUris || [];
  const route = inferRoute(
    input.prompt,
    input.definitions,
    referenceSlots.filter(slot => slot.hasReferenceImage).length,
    maskUris.length,
    input.settings,
  );

  return {
    sessionId: input.sessionId,
    projectId: input.projectId,
    userId: input.userId,
    itemId: input.item?.id ?? null,
    baseImageUri: input.item?.url ?? null,
    prompt: input.prompt,
    chatHistory: [{ role: 'user', parts: input.prompt }],
    subjectVault: buildSubjectVault(referenceUrisByRole, input.prompt),
    maskUris,
    referenceUris: Object.values(input.referenceAssetUris || {}).filter((uri): uri is string => !!uri),
    references: referenceSlots,
    generatedCandidates,
    settings: input.settings,
    route,
    source: {
      selectedItemId: input.item?.id ?? null,
      projectId: input.projectId,
      userId: input.userId,
    },
    timestamps: {
      compiledAt: new Date().toISOString(),
    },
  };
}

export function summarizeCreativeEditManifest(manifest: CreativeEditManifest): string {
  const parts = [
    manifest.route.label,
    manifest.settings.modelTier === 'pro' ? 'Pro' : 'Flash',
    manifest.settings.imageSize ?? manifest.settings.resolution,
    manifest.settings.grounding ? 'Grounded' : 'Ungrounded',
    manifest.settings.aspectRatio,
  ];

  return parts.join(' · ');
}
