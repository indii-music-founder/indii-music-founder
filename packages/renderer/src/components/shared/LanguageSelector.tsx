import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import type { Language } from '@/config/i18n';

const languageNames: Record<Language, string> = {
  'en-US': 'English',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'ja-JP': '日本語',
};

/**
 * Language Selector Component
 *
 * Allows users to switch between available languages
 */
export function LanguageSelector() {
  const { currentLanguage, availableLanguages, changeLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-sm font-medium text-gray-700">
        Language:
      </label>
      <select
        id="language-select"
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value as Language)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
      >
        {availableLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {languageNames[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSelector;
