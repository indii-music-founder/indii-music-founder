import { describe, expect, it } from 'vitest';
import { isLegacyEdgeRemoteEnabled } from './RemoteTransportPolicy';

describe('RemoteTransportPolicy', () => {
    it('keeps the unsupported edge transport disabled by default', () => {
        expect(isLegacyEdgeRemoteEnabled(undefined)).toBe(false);
        expect(isLegacyEdgeRemoteEnabled('false')).toBe(false);
    });

    it('requires an explicit opt-in to enable edge transport', () => {
        expect(isLegacyEdgeRemoteEnabled('true')).toBe(true);
        expect(isLegacyEdgeRemoteEnabled(' TRUE ')).toBe(true);
    });
});
