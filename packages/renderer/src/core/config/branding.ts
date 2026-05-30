/**
 * Branding Configuration — indii.music Identity System
 * 
 * Central location for all brand messaging, names, and taglines
 * Used across UI, marketing, documentation, and internal systems
 */

export const BRANDING = {
  // Core brand identity
  official_name: 'indii.music',
  full_brand_name: 'indii.music',
  tagline: 'your independence operating system',
  
  // Complete brand statements
  full_statement: 'indii.music, your independence operating system',
  
  // Brand variants (for different contexts)
  variants: {
    short: 'indii',
    platform: 'indii.music',
    statement_app: 'indii.music — your independence operating system',
    statement_marketing: 'indii.music: The independence operating system',
    statement_legal: 'indii.music (indii)',
  },
  
  // Organization details
  organization: {
    legal_name: 'New Detroit Music LLC',
    dba: 'indii.music',
    website: 'https://indii.music',
  },
  
  // Founders contact
  founders: {
    name: 'William Roberts',
    email: 'will@indii.music',
    role: 'Founder & CEO',
  },
  
  // Support & contact
  support: {
    email: 'support@indii.music',
    sales: 'sales@indii.music',
    legal: 'legal@indii.music',
    security: 'security@indii.music',
  },
  
  // Internal references (for storage keys, IDs, etc.)
  internal: {
    prefix: 'indii',
    localStorage_prefix: 'indii_',
    storage_bucket: 'indii-music',
  },
  
  // Version reference
  version_format: 'indii.music v{version}',
  
  // Meta description for web
  meta_description: 'indii.music: The independence operating system for independent music artists',
  
  // Document headers
  document_attribution: 'indii.music',
  document_produced_by: 'indii.music Studio',
};

// Helper function to get brand statement with version
export function getBrandStatement(version?: string): string {
  if (version) {
    return `indii.music v${version} — ${BRANDING.tagline}`;
  }
  return BRANDING.full_statement;
}

// Helper to get appropriate brand name for context
export function getBrandName(context: 'short' | 'platform' | 'full' | 'legal' = 'platform'): string {
  switch (context) {
    case 'short':
      return BRANDING.variants.short;
    case 'legal':
      return BRANDING.variants.statement_legal;
    case 'full':
      return BRANDING.full_statement;
    default:
      return BRANDING.official_name;
  }
}
