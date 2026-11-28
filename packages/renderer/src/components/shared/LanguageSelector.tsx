import React from 'react';
import { LANGUAGE_NAMES, useLanguage, type SupportedLanguage } from '@/hooks/useLanguage';
import { SelectDropdown } from '@/modules/settings/settings-panel/SettingsShared';
import { logger } from '@/utils/logger';

/**
 * Language Selector — switches the interface language among the
 * languages that have bundled translations.
 */
export function LanguageSelector() {
  const { currentLanguage, availableLanguages, changeLanguage } = useLanguage();

  return (
    <SelectDropdown
      value={currentLanguage}
      options={availableLanguages.map((lang) => ({ value: lang, label: LANGUAGE_NAMES[lang] }))}
      onChange={(value) => {
        changeLanguage(value as SupportedLanguage).catch((error: unknown) =>
          logger.error('[LanguageSelector] Failed to change language', error)
        );
      }}
    />
  );
}

export default LanguageSelector;
