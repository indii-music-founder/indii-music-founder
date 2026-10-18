import { describe, expect, it } from 'vitest';
import { isCopyrightPortalUrl } from './portalOrigins.js';
describe('verified eCO portal origins', () => {
  it('permits the official entry and observed Library of Congress redirect', () => {
    expect(isCopyrightPortalUrl('https://eco.copyright.gov/eService_enu/')).toBe(true);
    expect(isCopyrightPortalUrl('https://eservice.eco.loc.gov/eService_enu/?SWECmd=Start')).toBe(true);
  });
  it('rejects lookalikes, unencrypted transport, credentials and unexpected ports', () => {
    for (const url of ['http://eservice.eco.loc.gov/', 'https://eservice.eco.loc.gov.attacker.example/', 'https://eco.copyright.gov@attacker.example/', 'https://user@eservice.eco.loc.gov/', 'https://eservice.eco.loc.gov:444/', 'file:///tmp/index.html', 'invalid']) expect(isCopyrightPortalUrl(url)).toBe(false);
  });
});
