/**
 * Canonical indii.music brand assets — the single source of truth for the
 * brand name and tagline across every surface (marketing site, studio app,
 * metadata, PWA, collateral).
 *
 * The tagline is a PRIMARY BRAND ASSET. Do not modify it:
 *   - Always lowercase.
 *   - No period.
 *   - Do not prepend "the".
 *   - Do not capitalize individual words.
 *   - Do not paraphrase, shorten, or create alternate versions.
 * The exact string is used verbatim everywhere the canonical tagline appears.
 */

export const INDII_BRAND = {
  /** Canonical product name. */
  name: 'indii.music',

  /**
   * Canonical tagline — "music business at the speed of you".
   * Preserve exactly; see header rules.
   */
  tagline: 'music business at the speed of you',

  /**
   * Legacy positioning phrases from before the canonical tagline.
   * Retained only as reference; do not use in new surfaces.
   */
  legacy: {
    tagline: 'your independence operating system',
    statement: 'The operating system for musical independence.',
  },
} as const;

/** Convenience export for the canonical tagline string. */
export const INDII_TAGLINE: string = INDII_BRAND.tagline;

/** Canonical browser/social title pairing: "indii.music — music business at the speed of you". */
export const INDII_BRAND_TITLE: string = `${INDII_BRAND.name} — ${INDII_BRAND.tagline}`;
