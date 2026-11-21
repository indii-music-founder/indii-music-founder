import type { Download, Page } from 'playwright';
import { open } from 'node:fs/promises';

const maximumBytes = 32 * 1024 * 1024;
const catalog = 'https://fonts.google.com';

/** Accepts an archive only while a trusted caller is delivering a selected Google Fonts family. */
export class BoardroomFontDownload {
  private pending?: { filename: string; url: string; authorized: () => boolean };

  constructor(private readonly page: Page) {
    page.on('download', download => {
      if (this.matches(download)) return;
      void download.cancel().catch(() => {});
    });
  }

  private matches(download: Download): boolean {
    // Google Fonts builds the ZIP in a sandboxed frame. Its blob has an
    // opaque origin, so bind the event to the approved top-level selection.
    return Boolean(this.pending?.authorized() && this.page.url() === this.pending.url
      && download.suggestedFilename() === this.pending.filename
      && /^blob:null\/[a-f0-9-]{36}$/i.test(download.url()));
  }

  async saveSelected(family: string, authorized: () => boolean, stillControls: () => boolean, signal: AbortSignal) {
    const url = new URL(this.page.url());
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,69}$/.test(family) || url.origin !== catalog || url.pathname !== '/selection') {
      throw new Error('Select a family in Google Fonts before downloading it.');
    }
    if (!authorized() || signal.aborted) throw new Error('Browser control or the current page changed.');

    const filename = `${family.replace(/ /g, '_')}.zip`;
    const button = this.page.getByRole('button', { name: `Download font ${family}`, exact: true })
      .filter({ hasText: 'Download all (1)' });
    await button.waitFor({ state: 'visible', timeout: 5000 });
    const selectedDocument = await this.page.evaluateHandle(() => document);
    const approval = { filename, url: url.href, authorized: () => !signal.aborted && stillControls() };
    let download: Download | undefined;
    try {
      if (!authorized() || signal.aborted || this.page.url() !== url.href) {
        throw new Error('Browser control or the current page changed.');
      }
      this.pending = approval;
      [download] = await Promise.all([
        this.page.waitForEvent('download', { predicate: value => this.matches(value), timeout: 8000 }),
        button.click({ timeout: 3000 }),
      ]);
      if (!approval.authorized()) throw new Error('The font download was cancelled.');
      const file = await open(await download.path(), 'r');
      try {
        const { size } = await file.stat();
        if (size < 22 || size > maximumBytes) throw new Error('The font archive size is unsupported.');
        const bytes = await file.readFile();
        if (bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('Google Fonts did not return a ZIP archive.');
        // Google Fonts updates history at the same URL as it starts the
        // download. Deliver only while the original document still exists.
        const sameDocument = await selectedDocument.evaluate(original => original === document).catch(() => false);
        if (!sameDocument || !approval.authorized() || this.page.url() !== url.href) {
          throw new Error('The font download was cancelled.');
        }
        return { filename, bytes };
      } finally {
        await file.close();
      }
    } finally {
      this.pending = undefined;
      await download?.delete().catch(() => {});
      await selectedDocument.dispose().catch(() => {});
    }
  }
}
