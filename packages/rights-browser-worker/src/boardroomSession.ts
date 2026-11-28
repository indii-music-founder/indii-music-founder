import { chromium, type Browser, type Page } from 'playwright';
import { isBoardroomBrowserHostname, isBoardroomSpecialistPage, parseBoardroomPublicPage } from '@indii/shared';
import { BoardroomControl, type BoardroomAssignment, type BoardroomPageVersion } from './boardroomControl.js';
import { createPortalProxy } from './network.js';
import { BoardroomFontDownload } from './boardroomFontDownload.js';

const navigationTimeout = 15_000;
const viewport = { width: 1200, height: 900 };
const artistKeys = new Set(['Tab', 'Shift+Tab', 'Enter', 'Escape', 'Backspace', 'Delete', 'ArrowDown',
  'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End', 'Space']);
/** Browser-side implementation. The broker owns account authentication and session lifetime. */
export class BoardroomSession {
  readonly control = new BoardroomControl();
  private readonly fontDownload: BoardroomFontDownload;
  private operations: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly page: Page,
    private readonly browser: Browser,
    private readonly proxy: Awaited<ReturnType<typeof createPortalProxy>>,
  ) {
    this.fontDownload = new BoardroomFontDownload(page);
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) this.control.didNavigate();
    });
  }

  static async open(chromePath?: string) {
    const proxy = await createPortalProxy(isBoardroomBrowserHostname);
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({
        executablePath: chromePath,
        chromiumSandbox: true,
        proxy: { server: proxy.url, bypass: '<-loopback>' },
        args: [
          '--disable-quic',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
          '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
          // Use the Chromium namespace sandbox on Linux runtimes that prohibit setuid.
          ...(process.platform === 'linux' ? ['--disable-setuid-sandbox'] : []),
        ],
      });
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', acceptDownloads: true });
      await context.route('**/*', route => {
        const request = route.request();
        const url = parseBoardroomPublicPage(request.url());
        if (!url) return route.abort('blockedbyclient');
        // The public font catalog loads specimen metadata through a POST RPC.
        // Keep that exception on the catalog origin and on background requests.
        const catalogRequest = request.method() === 'POST'
          && url.origin === 'https://fonts.google.com'
          && ['/_/GoogleFontsCatalogUi/data/batchexecute', '/metadata/page'].includes(url.pathname)
          && ['fetch', 'xhr'].includes(request.resourceType())
          && request.frame().url().startsWith('https://fonts.google.com/');
        return (['GET', 'HEAD'].includes(request.method()) || catalogRequest)
          ? route.continue()
          : route.abort('blockedbyclient');
      });
      await context.routeWebSocket('**/*', socket => socket.close());
      const page = await context.newPage();
      context.on('page', popup => { if (popup !== page) void popup.close().catch(() => {}); });
      return new BoardroomSession(page, browser, proxy);
    } catch (error) {
      await browser?.close().catch(() => {});
      proxy.close();
      throw error;
    }
  }

  navigateAsArtist(url: string, expected: BoardroomPageVersion) {
    return this.enqueue(() => this.control.allowsArtist(expected), () => this.navigate(url));
  }

  historyAsArtist(action: 'back' | 'forward' | 'reload', expected: BoardroomPageVersion) {
    return this.enqueue(() => this.control.allowsArtist(expected), async () => {
      if (!parseBoardroomPublicPage(this.page.url())) throw new Error('Open a supported public page first.');
      this.control.didNavigate();
      const options = { waitUntil: 'domcontentloaded', timeout: navigationTimeout } as const;
      switch (action) {
        case 'back': await this.page.goBack(options); break;
        case 'forward': await this.page.goForward(options); break;
        case 'reload': await this.page.reload(options); break;
      }
    });
  }

  clickAsArtist(x: number, y: number, expected: BoardroomPageVersion) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= 1 || y < 0 || y >= 1) {
      return Promise.reject(new Error('Browser pointer is outside the page.'));
    }
    return this.enqueue(() => this.control.allowsArtist(expected),
      () => this.page.mouse.click(x * viewport.width, y * viewport.height));
  }

  scrollAsArtist(deltaX: number, deltaY: number, expected: BoardroomPageVersion) {
    if (![deltaX, deltaY].every(value => Number.isFinite(value) && Math.abs(value) <= 2000)) {
      return Promise.reject(new Error('Browser scroll exceeds the allowed range.'));
    }
    return this.enqueue(() => this.control.allowsArtist(expected), () => this.page.mouse.wheel(deltaX, deltaY));
  }

  keyAsArtist(key: string, expected: BoardroomPageVersion) {
    if (!artistKeys.has(key)) return Promise.reject(new Error('This key is unavailable in the browser.'));
    return this.enqueue(() => this.control.allowsArtist(expected), () => this.page.keyboard.press(key));
  }

  typeAsArtist(text: string, expected: BoardroomPageVersion) {
    if (typeof text !== 'string' || text.length > 500) return Promise.reject(new Error('Browser input is too long.'));
    return this.enqueue(() => this.control.allowsArtist(expected), () => this.page.keyboard.insertText(text));
  }

  followAsSpecialist(url: string, assignment: BoardroomAssignment, expected: BoardroomPageVersion) {
    // A specialist can follow a public link shown on the current page. It
    // cannot submit forms, dispatch input, or navigate to model-invented URLs.
    const authorized = () => this.control.allowsSpecialist(assignment, expected);
    return this.enqueue(authorized, async () => {
      const target = parseBoardroomPublicPage(url)?.href;
      if (!target || !isBoardroomSpecialistPage(target) || !isBoardroomSpecialistPage(this.page.url())) {
        throw new Error('Choose a supported research link on the current page.');
      }
      const links = await this.page.getByRole('link').evaluateAll(elements => elements.flatMap(element =>
        element instanceof HTMLAnchorElement && element.getClientRects().length ? [element.href] : []));
      if (!links.includes(target)) throw new Error('Choose a supported link visible on the current page.');
      if (!authorized()) throw new Error('Browser control or the current page changed.');
      await this.navigate(target);
    });
  }

  readAsSpecialist(assignment: BoardroomAssignment, expected: BoardroomPageVersion) {
    const authorized = () => this.control.allowsSpecialist(assignment, expected);
    return this.enqueue(authorized, async () => {
      if (!isBoardroomSpecialistPage(this.page.url())) throw new Error('Open a supported research page first.');
      const result = await this.readPage();
      if (!authorized()) throw new Error('Browser control or the current page changed.');
      if (!isBoardroomSpecialistPage(result.url)) throw new Error('Open a supported research page first.');
      return { ...result, links: result.links.filter(link => isBoardroomSpecialistPage(link.url)) };
    });
  }

  downloadFontAsSpecialist(
    family: string,
    assignment: BoardroomAssignment,
    expected: BoardroomPageVersion,
    signal: AbortSignal,
  ) {
    const authorized = () => !signal.aborted && this.control.allowsSpecialist(assignment, expected);
    const stillControls = () => this.control.allowsSpecialist(assignment, {
      ...expected,
      navigationGeneration: this.control.state.navigationGeneration,
    });
    return this.enqueue(authorized, async () => {
      if (!isBoardroomSpecialistPage(this.page.url())) throw new Error('Open a supported research page first.');
      if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,69}$/.test(family)) throw new Error('Choose a Google Fonts family.');
      if (this.page.url() !== 'https://fonts.google.com/selection') {
        await this.navigate(`https://fonts.google.com/specimen/${encodeURIComponent(family)}`);
        const page = this.control.state;
        const getFont = this.page.getByRole('button', { name: 'Get font', exact: true });
        await getFont.waitFor({ state: 'visible', timeout: 8000 });
        if (signal.aborted || !this.control.allowsSpecialist(assignment, page)) {
          throw new Error('Browser control or the current page changed.');
        }
        await getFont.press('Enter', { timeout: 3000 });
        await this.page.waitForURL('https://fonts.google.com/selection', { timeout: 5000 });
      }
      const page = this.control.state;
      return this.fontDownload.saveSelected(family, () => stillControls()
        && this.control.state.navigationGeneration === page.navigationGeneration, stillControls, signal);
    });
  }

  captureAsArtist(expected: BoardroomPageVersion) {
    const authorized = () => this.control.allowsArtist(expected);
    return this.enqueue(authorized, async () => {
      const result = await this.readPage();
      if (!authorized()) throw new Error('Browser control or the current page changed.');
      return result;
    });
  }

  get url() {
    return this.page.url();
  }

  frame() {
    return this.page.screenshot({ type: 'jpeg', quality: 65, timeout: navigationTimeout });
  }

  async close() {
    this.control.stop();
    try {
      await this.browser.close();
    } finally {
      this.proxy.close();
    }
  }

  private async readPage() {
    const captured = await this.page.locator('body').evaluate(body => ({
      url: document.URL,
      title: document.title,
      text: body instanceof HTMLElement ? body.innerText.slice(0, 10_000) : '',
      links: Array.from(document.links)
        .filter(link => link.getClientRects().length > 0)
        .map(link => ({ url: link.href, label: link.textContent?.trim().slice(0, 160) ?? '' })),
    }), undefined, { timeout: navigationTimeout });
    if (!parseBoardroomPublicPage(captured.url)) throw new Error('Open a supported public page first.');
    return {
      ...captured,
      links: captured.links.filter(link => link.label && parseBoardroomPublicPage(link.url)).slice(0, 60),
    };
  }

  private async navigate(url: string) {
    const target = parseBoardroomPublicPage(url);
    if (!target) throw new BoardroomNavigationError('Enter a public HTTPS address.');
    this.control.didNavigate();
    try {
      await this.page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: navigationTimeout });
    } catch {
      throw new BoardroomNavigationError(`Could not load ${target.hostname}. Check the address or try opening it externally.`);
    }
  }

  private enqueue<T>(authorized: () => boolean, operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(() => {
      if (!authorized()) throw new Error('Browser control or the current page changed.');
      return operation();
    });
    this.operations = result.catch(() => {});
    return result;
  }
}

export class BoardroomNavigationError extends Error {}
