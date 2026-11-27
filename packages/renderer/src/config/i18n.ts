import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import enUS from '@/config/locales/en-US.json';
import esES from '@/config/locales/es-ES.json';
import frFR from '@/config/locales/fr-FR.json';
import deDE from '@/config/locales/de-DE.json';
import jaJP from '@/config/locales/ja-JP.json';

export type Language = 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE' | 'ja-JP';

const resources = {
  'en-US': { translation: enUS },
  'es-ES': { translation: esES },
  'fr-FR': { translation: frFR },
  'de-DE': { translation: deDE },
  'ja-JP': { translation: jaJP },
};

const defaultLanguage: Language = 'en-US';
const savedLanguage = (localStorage.getItem('i18n_language') as Language) || defaultLanguage;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: defaultLanguage,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    ns: ['translation'],
    defaultNS: 'translation',
    react: {
      useSuspense: false,
    },
  });

export default i18n;
