import type { Page } from 'playwright';
import type { RightsCase } from '@indii/shared';

export const COPYRIGHT_ADAPTERS = Object.freeze({
  standard: { applicationLabel: 'Standard Application', instructions: 'https://www.copyright.gov/eco/help-type.html' },
  gruw: { applicationLabel: 'Register a Group of Unpublished Works', instructions: 'https://www.copyright.gov/eco/help/group-unpublished/' },
  gram_composition: { applicationLabel: 'Musical Works from an Album', instructions: 'https://www.copyright.gov/eco/gram-pa/help-gram-pa.html' },
  gram_recording: { applicationLabel: 'Sound Recordings from an Album', instructions: 'https://www.copyright.gov/eco/gram-sr/help-gram-sr.html' },
});

/** Human-readable AX snapshot stays in memory; no model access during human control. */
export async function observeApplication(page: Page): Promise<string> {
  const snapshot = await page.locator('body').ariaSnapshot({ timeout: 5000 });
  // Values and credential fields are excluded; structure, labels and errors remain.
  return snapshot.split('\n').filter(line => !/password|credit.card|cvv|security.code|routing|account.number|verification.code|one.time|token/i.test(line))
    .map(line => line.replace(/: ".+"$/, ': [value redacted]')).join('\n').slice(0, 12_000);
}

export async function executeCopyrightAction(page: Page, manifest: RightsCase, actionId: string): Promise<void> {
  if (new URL(page.url()).hostname !== 'eco.copyright.gov') throw new Error('Not an eCO application');
  const observation = await observeApplication(page);
  if (/password|certif|payment|pay.gov|credit card|deposit account|captcha|sign in/i.test(observation)) throw new Error('Artist control required');
  if (actionId === 'open_application') {
    const link = page.getByRole('link', { name: COPYRIGHT_ADAPTERS[manifest.applicationKind].applicationLabel, exact: true });
    if (await link.count() !== 1) throw new Error('Application link is not uniquely verified');
    await link.click();
    return;
  }
  if (manifest.works.length !== 1) throw new Error('Choose the group application fields with artist control');
  const mapping = actionId === 'fill_title' ? { label: 'Title of this work', value: manifest.works[0].title }
    : actionId === 'fill_year' ? { label: 'Year of Completion', value: String(manifest.works[0].yearOfCreation) } : undefined;
  if (!mapping) throw new Error('Action is not allowed');
  const target = page.getByRole('textbox', { name: mapping.label, exact: true });
  if (await target.count() !== 1 || !await target.isVisible() || !await target.isEnabled()) throw new Error('Field is not uniquely verified');
  await target.fill(mapping.value);
  if (await target.inputValue() !== mapping.value) throw new Error('Field value was not retained');
}
