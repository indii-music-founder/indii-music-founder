import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import type { Language } from '@/config/i18n';

/**
 * Hook for language management and i18n
 */
export function useLanguage() {
  const { i18n, t } = useTranslation();

  const changeLanguage = useCallback(
    async (language: Language) => {
      localStorage.setItem('i18n_language', language);
      await i18n.changeLanguage(language);
    },
    [i18n]
  );

  const currentLanguage = i18n.language as Language;

  const availableLanguages: Language[] = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'];

  return {
    currentLanguage,
    availableLanguages,
    t,
    changeLanguage,
    i18n,
  };
}
