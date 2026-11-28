import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * Languages with bundled translations in the live i18n instance (`@/core/i18n`).
 * Add a language here only after its resource file is registered there.
 */
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
};

function toSupported(language: string | undefined): SupportedLanguage {
  const base = (language ?? '').split('-')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as SupportedLanguage) : 'en';
}

/**
 * Hook for language management against the app's live i18n instance.
 * The browser language detector in `@/core/i18n` persists the choice.
 */
export function useLanguage() {
  const { i18n, t } = useTranslation();

  const changeLanguage = useCallback(
    async (language: SupportedLanguage) => {
      await i18n.changeLanguage(language);
    },
    [i18n]
  );

  return {
    currentLanguage: toSupported(i18n.resolvedLanguage ?? i18n.language),
    availableLanguages: SUPPORTED_LANGUAGES,
    t,
    changeLanguage,
    i18n,
  };
}
