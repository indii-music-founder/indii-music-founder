// Structural-only component regression coverage; not genuine-user acceptance.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SectionShareRedirect from './SectionShareRedirect';
import { SITE_SECTIONS, siteSectionOgImagePath } from '@shared/share/siteSections';

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.hash}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/s/:section" element={<SectionShareRedirect />} />
        <Route path="/" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SectionShareRedirect', () => {
  it('lands a known section link on its home-page anchor', () => {
    const { getByTestId } = renderAt('/s/pricing');
    expect(getByTestId('where').textContent).toBe('/#pricing');
  });

  it('sends unknown sections to the top of the home page', () => {
    const { getByTestId } = renderAt('/s/not-a-section');
    expect(getByTestId('where').textContent).toBe('/');
  });
});

describe('site section previews', () => {
  it('has a committed preview image for every shareable section', () => {
    for (const section of SITE_SECTIONS) {
      const file = resolve(__dirname, '../../public', `.${siteSectionOgImagePath(section)}`);
      expect(existsSync(file), file).toBe(true);
    }
  });
});
