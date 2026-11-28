import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useStore } from '@/core/store';
import { SettingRow, Toggle } from '@/modules/settings/settings-panel/SettingsShared';
import { PrivacyPreferencesService } from '@/services/privacy/PrivacyPreferencesService';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';

/**
 * Item 304: CCPA "Do Not Sell or Share My Personal Information" opt-out.
 *
 * Saved to the account (`users/{uid}.privacyPreferences.doNotSell`) and
 * enforced on this device: analytics and marketing consent are forced off and
 * error reports carry no email or IP.
 */
export function DoNotSellToggle() {
    const uid = useStore((state) => state.user?.uid ?? null);
    const toast = useToast();
    const [doNotSell, setDoNotSell] = useState(false);
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        PrivacyPreferencesService.loadDoNotSell(uid)
            .then((value) => { if (!cancelled) setDoNotSell(value); })
            .catch((error: unknown) => {
                logger.error('[CCPA] Failed to load privacy preferences', error);
                if (!cancelled) toast.error('Could not load your privacy choice. Refresh to try again.');
            })
            .finally(() => { if (!cancelled) setReady(true); });
        return () => { cancelled = true; };
    }, [uid, toast]);

    const handleToggle = async (next: boolean) => {
        if (!uid) return;
        setSaving(true);
        try {
            await PrivacyPreferencesService.saveDoNotSell(uid, next);
            setDoNotSell(next);
            toast.success(next ? 'You have opted out of selling or sharing.' : 'Opt-out removed.');
        } catch (error: unknown) {
            logger.error('[CCPA] Failed to save privacy preferences', error);
            toast.error('Could not save your privacy choice. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingRow
            icon={Shield}
            label="Do Not Sell or Share My Personal Information"
            description="indii does not sell your personal information. Turning this on records your opt-out on your account, blocks analytics and marketing sharing, and removes your email from error reports."
        >
            <Toggle
                label="Do Not Sell or Share My Personal Information"
                enabled={doNotSell}
                disabled={!uid || !ready || saving}
                onChange={(value) => void handleToggle(value)}
            />
        </SettingRow>
    );
}

export default DoNotSellToggle;
