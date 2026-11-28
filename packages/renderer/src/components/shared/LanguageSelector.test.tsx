import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const changeLanguage = vi.fn(async () => undefined);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (s: string) => s,
        i18n: { language: 'es-419', resolvedLanguage: undefined, changeLanguage },
    }),
}));

import { LanguageSelector } from '@/components/shared/LanguageSelector';

describe('LanguageSelector', () => {
    it('offers only languages with bundled translations and maps regional codes to them', () => {
        render(<LanguageSelector />);
        const select = screen.getByRole('combobox') as HTMLSelectElement;

        expect([...select.options].map((o) => o.value)).toEqual(['en', 'es']);
        expect(select.value).toBe('es');
    });

    it('switches the live i18n language', () => {
        render(<LanguageSelector />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });

        expect(changeLanguage).toHaveBeenCalledWith('en');
    });
});
