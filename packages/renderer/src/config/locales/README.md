# Internationalization (i18n)

Multi-language support for indiiOS with i18next framework.

## Supported Languages

- **English** (en-US) - Default language
- **Spanish** (es-ES)
- **French** (fr-FR)
- **German** (de-DE)
- **Japanese** (ja-JP)

## File Structure

```
src/
├── config/
│   ├── i18n.ts                 # i18n configuration
│   └── locales/
│       ├── en-US.json          # English translations (reference)
│       ├── es-ES.json          # Spanish translations
│       ├── fr-FR.json          # French translations
│       ├── de-DE.json          # German translations
│       └── ja-JP.json          # Japanese translations
├── hooks/
│   └── useLanguage.ts          # Language management hook
└── components/
    └── shared/
        └── LanguageSelector.tsx # Language selector component
```

## Translation Keys

Organized by domain for easier management:

### Common Keys
- `common.*` - Global UI buttons and labels (Save, Cancel, etc.)
- `navigation.*` - Sidebar and navigation items
- `auth.*` - Authentication UI (Login, Signup, etc.)
- `creative.*` - Creative module specific text
- `video.*` - Video module specific text
- `distribution.*` - Distribution module specific text
- `finance.*` - Finance module specific text
- `errors.*` - Error messages
- `messages.*` - User-facing messages

## Usage

### In Components

```typescript
import { useLanguage } from '@/hooks/useLanguage';

function MyComponent() {
  const { t } = useLanguage();

  return (
    <div>
      <button>{t('common.save')}</button>
      <p>{t('auth.email')}</p>
    </div>
  );
}
```

### Language Selector

```typescript
import { LanguageSelector } from '@/components/shared/LanguageSelector';

function Header() {
  return (
    <header>
      <h1>indiiOS</h1>
      <LanguageSelector />
    </header>
  );
}
```

### Change Language Programmatically

```typescript
import { useLanguage } from '@/hooks/useLanguage';

function MyComponent() {
  const { changeLanguage } = useLanguage();

  return (
    <button onClick={() => changeLanguage('es-ES')}>
      Switch to Spanish
    </button>
  );
}
```

## Adding New Keys

1. Add the key to `locales/en-US.json` (reference language)
2. Add translations to other language files
3. Use in components with `t('key.path')`

Example:

```json
// en-US.json
{
  "myFeature": {
    "title": "My Feature",
    "description": "Description"
  }
}

// Usage
const { t } = useLanguage();
t('myFeature.title'); // "My Feature"
```

## Language Detection

The system automatically detects and applies:
1. User's saved language preference (localStorage)
2. Browser language preference
3. Defaults to English if no preference

## Configuration

Located in `src/config/i18n.ts`:

- **Default Language**: en-US
- **Fallback Language**: en-US
- **Storage**: localStorage (key: `i18n_language`)

## Item #48 - Platinum Release

This implementation completes TOP_50 Item #48:
> "Add internationalization (i18n) framework for multi-language support"

Features:
- 5 supported languages
- Persistent language preference
- React hook integration
- Language selector component
- Organized translation keys
- Easy expansion for new languages
