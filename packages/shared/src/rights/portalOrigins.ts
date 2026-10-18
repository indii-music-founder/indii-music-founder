/** Official entry redirect observed at the real eCO portal on 2026-10-18. */
export const COPYRIGHT_PORTAL_HOSTS: readonly string[] = Object.freeze(['eco.copyright.gov', 'eservice.eco.loc.gov']);
export function isCopyrightPortalUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && COPYRIGHT_PORTAL_HOSTS.includes(url.hostname); }
  catch { return false; }
}
