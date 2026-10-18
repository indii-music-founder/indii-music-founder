import type { Page } from 'playwright';
import { isCopyrightPortalUrl, COPYRIGHT_APPLICATION_ROUTES, type RightsCase } from '@indii/shared';

export const COPYRIGHT_ADAPTERS = Object.freeze({
  standard: { applicationLabel: 'Standard Application', instructions: 'https://www.copyright.gov/eco/help-type.html' },
  gruw: { applicationLabel: 'Register a Group of Unpublished Works', instructions: 'https://www.copyright.gov/eco/help/group-unpublished/' },
  gram_composition: { applicationLabel: 'Register Certain Groups of Published Works', instructions: 'https://www.copyright.gov/eco/gram-pa/help-gram-pa.html' },
  gram_recording: { applicationLabel: 'Register Certain Groups of Published Works', instructions: 'https://www.copyright.gov/eco/gram-sr/help-gram-sr.html' },
});

/** Human-readable AX snapshot stays in memory; no model access during human control. */
export async function observeApplication(page: Page): Promise<string> {
  const snapshot = await page.locator('body').ariaSnapshot({ timeout: 5000 });
  // Values and credential fields are excluded; structure, labels and errors remain.
  return snapshot.split('\n').filter(line => !/password|credit.card|cvv|security.code|routing|account.number|verification.code|one.time|token/i.test(line))
    .map(line => line.replace(/: ".+"$/, ': [value redacted]')).join('\n').slice(0, 12_000);
}

export async function executeCopyrightAction(page: Page, manifest: RightsCase, actionId: string): Promise<void> {
  if (!isCopyrightPortalUrl(page.url())) throw new Error('Not an eCO application');
  // Navigation instructions may mention payment or deposit accounts without being a sensitive form.
  // Inspect active controls before collecting any semantic observation.
  if (await page.locator('input[type="password"]:visible, input[autocomplete="one-time-code"]:visible').count()
    || await page.getByRole('textbox', { name: /credit card|card number|security code|cvv|routing number|account number|certifying|signature|verification code|challenge answer/i }).count()
    || await page.getByRole('checkbox', { name: /certify|under penalty/i }).count()
    || await page.getByRole('heading', { name: /^(?:payment|certification|sign in|user login)/i }).count()) throw new Error('Artist control required');
  if (actionId === 'open_application') {
    const route = COPYRIGHT_APPLICATION_ROUTES[manifest.applicationKind];
    const link = page.getByRole('link', { name: route.entryLabel, exact: true });
    if (await link.count() !== 1) throw new Error('Application link is not uniquely verified');
    await link.click({ timeout: 10_000 });
    const overview = page.getByText(route.overview, { exact: true });
    await overview.waitFor({ state: 'visible', timeout: 10_000 });
    if (await overview.count() !== 1 || !isCopyrightPortalUrl(page.url())) throw new Error('Application destination was not verified');
    return;
  }
  if (manifest.works.length !== 1) throw new Error('Choose the group application fields with artist control');
  const mapping = actionId === 'fill_title' ? { label: 'Title of this work', value: manifest.works[0].title }
    : actionId === 'fill_year' ? { label: 'Year of Completion', value: String(manifest.works[0].yearOfCreation) } : undefined;
  if (!mapping) throw new Error('Action is not allowed');
  const target = page.getByRole('textbox', { name: mapping.label, exact: true });
  if (await target.count() !== 1 || !await target.isVisible() || !await target.isEnabled()) throw new Error('Field is not uniquely verified');
  await target.fill(mapping.value, { timeout: 10_000 });
  if (await target.inputValue() !== mapping.value) throw new Error('Field value was not retained');
}
