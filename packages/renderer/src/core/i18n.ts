import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';

/**
 * i18n Configuration — indiiOS Internationalization Foundation
 *
 * Setup:
 *   - Uses browser language detection (navigator.language, localStorage, querystring)
 *   - Falls back to English ('en') if detection fails
 *   - Translation resources bundled inline (no HTTP backend) for instant load
 *   - Interpolation escaping disabled — React already escapes by default
 *   - Spanish (es-419) support added for Item 313
 *
 * Usage in components:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <span>{t('sidebar.dashboard')}</span>
 *
 * Adding a new language:
 *   1. Create src/assets/locales/<lang>.json following en.json structure
 *   2. Import it here and add to `resources`
 */
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            es: { translation: es },
        },
        fallbackLng: 'en',
        debug: import.meta.env.DEV,
        interpolation: {
            escapeValue: false, // React escapes by default
        },
        detection: {
            order: ['querystring', 'localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupQuerystring: 'lng',
            lookupLocalStorage: 'indiiOS_language',
        },
        returnNull: false,
    });

export default i18n;
