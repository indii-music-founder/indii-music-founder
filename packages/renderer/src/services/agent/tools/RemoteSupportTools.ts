import { getDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { requestSettingsSection } from '@/modules/settings/SettingsNavigation';
import { isFreshStudioState, type DesktopState } from '../RemoteRelayService';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const RemoteSupportTools = {
    open_remote_setup: wrapTool('open_remote_setup', async () => {
        requestSettingsSection('remote');
        const { useStore } = await import('@/core/store');
        await useStore.getState().setModule('settings');
        return toolSuccess(
            { module: 'settings', section: 'remote' },
            'Opened Settings > Mobile Remote.',
        );
    }),

    get_remote_status: wrapTool('get_remote_status', async () => {
        const user = auth.currentUser;
        if (!user) {
            return toolSuccess({
                controllerAuthenticated: false,
                studioActive: false,
                supportedTransport: 'cloud-relay',
                protocolVersion: 1,
            }, 'Mobile Remote is signed out.');
        }

        const snapshot = await getDoc(doc(db, 'users', user.uid, 'remote-relay', 'state'));
        const state = snapshot.exists() ? snapshot.data() as DesktopState : null;
        const studioActive = isFreshStudioState(state);
        return toolSuccess({
            controllerAuthenticated: true,
            studioActive,
            studioOnline: state?.online === true,
            executorReady: state?.listenerReady === true,
            protocolVersion: typeof state?.protocolVersion === 'number' ? state.protocolVersion : null,
            supportedTransport: 'cloud-relay',
        }, studioActive ? 'The Studio executor is active.' : 'The controller is authenticated, but no fresh Studio executor is active.');
    }),
} satisfies Record<string, AnyToolFunction>;
