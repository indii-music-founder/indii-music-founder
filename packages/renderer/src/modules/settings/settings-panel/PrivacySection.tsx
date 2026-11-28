/**
 * Privacy Settings Section
 *
 * Lets the user change the consent they gave in the cookie banner at any time
 * and record a "Do Not Sell or Share" opt-out.
 */

import React, { useEffect, useState } from 'react';
import { Bug, ExternalLink } from 'lucide-react';
import { SectionHeader, SettingRow, Toggle } from '@/modules/settings/settings-panel/SettingsShared';
import { DoNotSellToggle } from '@/components/shared/DoNotSellToggle';
import {
    CONSENT_CHANGED_EVENT,
    getConsentPreferences,
    updateConsentPreferences,
} from '@/services/privacy/consent';

const PrivacySection: React.FC = () => {
    const [errorReports, setErrorReports] = useState(() => getConsentPreferences()?.errorTracking === true);

    useEffect(() => {
        const sync = () => setErrorReports(getConsentPreferences()?.errorTracking === true);
        window.addEventListener(CONSENT_CHANGED_EVENT, sync);
        return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
    }, []);

    return (
        <div>
            <SectionHeader
                title="Privacy"
                description="Choose what optional data indii collects on this device."
            />

            <div className="space-y-1">
                <SettingRow
                    icon={Bug}
                    label="Error reports"
                    description="Send crash reports and short, text-masked session replays so we can fix problems. Turning this off stops reporting right away."
                >
                    <Toggle
                        label="Error reports"
                        enabled={errorReports}
                        onChange={(value) => setErrorReports(updateConsentPreferences({ errorTracking: value }).errorTracking)}
                    />
                </SettingRow>

                <DoNotSellToggle />
            </div>

            <a
                href="/legal/privacy"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
                <ExternalLink size={12} />
                Privacy Policy
            </a>
        </div>
    );
};

export default PrivacySection;
