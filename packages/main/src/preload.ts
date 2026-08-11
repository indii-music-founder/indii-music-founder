import { contextBridge, ipcRenderer } from 'electron';

console.log('[preload] Preload script loaded.');

// Type definitions for IPC communication
interface Credentials {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    [key: string]: string | undefined;
}

interface SFTPConfig {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
    // General
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    setPrivacyMode: (enabled: boolean) => ipcRenderer.invoke('privacy:toggle-protection', enabled),
    selectFile: (options?: unknown) => ipcRenderer.invoke('system:select-file', options),
    selectDirectory: (options?: unknown) => ipcRenderer.invoke('system:select-directory', options),
    getDirectoryContents: (dirPath: string, options?: { recursive?: boolean, extensions?: string[] }) => ipcRenderer.invoke('system:get-directory-contents', dirPath, options),
    searchApprovedAssets: (dirPath: string, options?: { query?: string, extensions?: string[], maxResults?: number }) => ipcRenderer.invoke('system:search-approved-assets', dirPath, options),
    getGpuInfo: () => ipcRenderer.invoke('system:get-gpu-info'),
    showNotification: (title: string, body: string) => ipcRenderer.send('show-notification', { title, body }),

    // Auth (Simplified - login handled via Firebase SDK in renderer)
    auth: {
        // Login is now handled directly via Firebase signInWithPopup in the renderer
        // No need for IPC - it works natively in Electron's Chromium
        logout: () => ipcRenderer.invoke('auth:logout'),
        onUserUpdate: (callback: (tokens: { idToken: string, accessToken?: string | null, source?: string | null } | null) => void) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const handler = (_event: unknown, tokens: any) => callback(tokens);
            ipcRenderer.on('auth:user-update', handler);
            return () => ipcRenderer.removeListener('auth:user-update', handler);
        },
        onError: (callback: (data: { message: string }) => void) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const handler = (_event: unknown, data: any) => callback(data);
            ipcRenderer.on('auth:error', handler);
            return () => ipcRenderer.removeListener('auth:error', handler);
        }
    },

    // Credentials (Secure Main Process Storage)
    credentials: {
        save: (id: string, creds: Credentials) => ipcRenderer.invoke('credentials:save', id, creds),
        get: (id: string): Promise<Credentials | null> => ipcRenderer.invoke('credentials:get', id),
        delete: (id: string) => ipcRenderer.invoke('credentials:delete', id),
        list: (): Promise<string[]> => ipcRenderer.invoke('credentials:list')
    },

    // Audio (Native Processing)
    audio: {
        analyze: (filePath: string) => ipcRenderer.invoke('audio:analyze', filePath),
        getMetadata: (hash: string) => ipcRenderer.invoke('audio:lookup-metadata', hash),
        transcode: (options: unknown) => ipcRenderer.invoke('audio:transcode', options),
        master: (options: unknown) => ipcRenderer.invoke('audio:master', options)
    },

    // Network (Main Process Fetching)
    network: {
        fetchUrl: (url: string) => ipcRenderer.invoke('net:fetch-url', url),
        fetchUrlBase64: (url: string) => ipcRenderer.invoke('net:fetch-url-base64', url)
    },

    // SFTP (Distribution)
    sftp: {
        connect: (config: SFTPConfig) => ipcRenderer.invoke('sftp:connect', config),
        connectDistributor: (distributorId: string) => ipcRenderer.invoke('sftp:connect-distributor', distributorId),
        uploadDirectory: (localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload-directory', localPath, remotePath),
        disconnect: () => ipcRenderer.invoke('sftp:disconnect'),
        isConnected: () => ipcRenderer.invoke('sftp:is-connected'),
        listDirectory: (remotePath: string) => ipcRenderer.invoke('sftp:list-directory', remotePath),
        readFile: (remotePath: string) => ipcRenderer.invoke('sftp:read-file', remotePath),
    },
    // Brand Capabilities
    brand: {
        analyzeConsistency: (assetPath: string, brandKit: unknown) => ipcRenderer.invoke('brand:analyze-consistency', assetPath, brandKit),
    },
    publicist: {
        generatePdf: (data: unknown) => ipcRenderer.invoke('publicist:generate-pdf', data),
    },
    marketing: {
        analyzeTrends: (data: unknown) => ipcRenderer.invoke('marketing:analyze-trends', data),
    },
    security: {
        rotateCredentials: (data: unknown) => ipcRenderer.invoke('security:rotate-credentials', data),
        scanVulnerabilities: (data: unknown) => ipcRenderer.invoke('security:scan-vulnerabilities', data),
    },
    // Agent Capabilities
    agent: {
        navigateAndExtract: (url: string) => ipcRenderer.invoke('agent:navigate-and-extract', url),
        performAction: (action: string, selector: string, text?: string) => ipcRenderer.invoke('agent:perform-action', action, selector, text),
        captureState: () => ipcRenderer.invoke('agent:capture-state'),
        saveHistory: (id: string, data: unknown) => ipcRenderer.invoke('agent:save-history', id, data),
        getHistory: (id: string) => ipcRenderer.invoke('agent:get-history', id),
        deleteHistory: (id: string) => ipcRenderer.invoke('agent:delete-history', id),
        scanDirectory: () => ipcRenderer.invoke('agent:scan-directory'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createArtifact: (filename: string, content: string, options: any) => ipcRenderer.invoke('agent:create-artifact', filename, content, options),
        listArtifacts: () => ipcRenderer.invoke('agent:list-artifacts'),
        readArtifact: (filename: string) => ipcRenderer.invoke('agent:read-artifact', filename),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        multiReplaceFileContent: (args: any) => ipcRenderer.invoke('agent:multi-replace-file-content', args),
        updateKnowledge: (filePath: string, action: 'add' | 'remove', content: string) => ipcRenderer.invoke('agent:update-knowledge', filePath, action, content),
        getCapabilityRegistry: () => ipcRenderer.invoke('agent:get-capability-registry'),
    },
    // Computer Capability (CE-1: read path, ISSUE-1110. CE-2: input control + kill switch, ISSUE-1111)
    computer: {
        checkPermissions: () => ipcRenderer.invoke('computer:check-permissions'),
        screenshot: (options?: { displayId?: number }) => ipcRenderer.invoke('computer:screenshot', options),
        listApps: () => ipcRenderer.invoke('computer:list-apps'),
        openApp: (app: string) => ipcRenderer.invoke('computer:open-app', app),
        click: (x: number, y: number, button?: 'left' | 'right' | 'double') => ipcRenderer.invoke('computer:click', { x, y, button }),
        type: (text: string) => ipcRenderer.invoke('computer:type', { text }),
        key: (combo: string) => ipcRenderer.invoke('computer:key', { combo }),
        scroll: (dx: number, dy: number) => ipcRenderer.invoke('computer:scroll', { dx, dy }),
        abort: () => ipcRenderer.invoke('computer:abort'),
        resetAbort: () => ipcRenderer.invoke('computer:reset-abort'),
        getAbortState: () => ipcRenderer.invoke('computer:get-abort-state'),
        allowlistGet: () => ipcRenderer.invoke('computer:allowlist-get'),
        allowlistAdd: (app: string) => ipcRenderer.invoke('computer:allowlist-add', app),
        allowlistRemove: (app: string) => ipcRenderer.invoke('computer:allowlist-remove', app),
        grantSession: (sessionId: string, ttlMs?: number) => ipcRenderer.invoke('computer:grant-session', { sessionId, ttlMs }),
        revokeGrant: (sessionId: string) => ipcRenderer.invoke('computer:revoke-grant', sessionId),
        hasGrant: (sessionId: string) => ipcRenderer.invoke('computer:has-grant', sessionId),
    },

    // Video (Local Asset Management)
    video: {
        saveAsset: (url: string, filename: string) => ipcRenderer.invoke('video:save-asset', url, filename),
        openFolder: (filePath?: string) => ipcRenderer.invoke('video:open-folder', filePath),
        render: (config: unknown) => ipcRenderer.invoke('video:render', config),
        getDefaultPath: (filename?: string) => ipcRenderer.invoke('video:get-default-path', filename),
    },



    // Distribution
    distribution: {
        stageRelease: (releaseId: string, files: { type: string, data: string, name: string }[]) => ipcRenderer.invoke('distribution:stage-release', releaseId, files),
        runForensics: (filePath: string) => ipcRenderer.invoke('distribution:run-forensics', filePath),
        packageITMSP: (releaseId: string) => ipcRenderer.invoke('distribution:package-itmsp', releaseId),
        calculateTax: (data: unknown) => ipcRenderer.invoke('distribution:calculate-tax', data),
        certifyTax: (userId: string, data: unknown) => ipcRenderer.invoke('distribution:certify-tax', userId, data),
        executeWaterfall: (data: unknown) => ipcRenderer.invoke('distribution:execute-waterfall', data),
        validateMetadata: (metadata: unknown) => ipcRenderer.invoke('distribution:validate-metadata', metadata),
        generateISRC: (options?: unknown) => ipcRenderer.invoke('distribution:generate-isrc', options),
        generateUPC: (options?: unknown) => ipcRenderer.invoke('distribution:generate-upc', options),
        registerRelease: (metadata: unknown, releaseId?: string) => ipcRenderer.invoke('distribution:register-release', metadata, releaseId),
        generateDDEX: (metadata: unknown) => ipcRenderer.invoke('distribution:generate-ddex', metadata),
        generateContentIdCSV: (data: unknown) => ipcRenderer.invoke('distribution:generate-content-id-csv', data),
        generateBWARM: (data: unknown) => ipcRenderer.invoke('distribution:generate-bwarm', data),
        checkMerlinStatus: (data: unknown) => ipcRenderer.invoke('distribution:check-merlin-status', data),
        transmit: (config: unknown) => ipcRenderer.invoke('distribution:transmit', config),
        submitRelease: (releaseData: unknown) => ipcRenderer.invoke('distribution:submit-release', releaseData),
        onSubmitProgress: (callback: (data: unknown) => void) => {
            const handler = (_event: unknown, data: unknown) => callback(data);
            ipcRenderer.on('distribution:submit-progress', handler);
            return () => ipcRenderer.removeListener('distribution:submit-progress', handler);
        },
        onTransmitProgress: (callback: (data: unknown) => void) => {
            const handler = (_event: unknown, data: unknown) => callback(data);
            ipcRenderer.on('distribution:transmit-progress', handler);
            return () => ipcRenderer.removeListener('distribution:transmit-progress', handler);
        },
        packageSpotify: (releaseId: string, stagingPath: string, outputPath?: string) => ipcRenderer.invoke('distribution:package-spotify', releaseId, stagingPath, outputPath),
        deliverApple: (command: string, bundlePath: string) => ipcRenderer.invoke('distribution:deliver-apple', command, bundlePath),
        validateXSD: (xmlContent: string) => ipcRenderer.invoke('distribution:validate-xsd', xmlContent),
    },

    // Sonic Bridge — watches a DAW bounce folder and pushes new audio to the app.
    // ISSUE-1283: the main-process handlers existed but were never exposed here, so
    // the whole feature was unreachable from the renderer. Wired up 2026-07-30.
    sonicBridge: {
        /** Opens a native folder picker, then watches the chosen folder for new bounces. */
        watchFolder: () => ipcRenderer.invoke('sonic-bridge:watch-folder'),
        stopWatching: () => ipcRenderer.invoke('sonic-bridge:stop-watching'),
        /** Subscribe to new-bounce events. Returns an unsubscribe function. */
        onNewBounce: (callback: (data: unknown) => void) => {
            const handler = (_event: unknown, data: unknown) => callback(data);
            ipcRenderer.on('sonic-bridge:new-bounce', handler);
            return () => ipcRenderer.removeListener('sonic-bridge:new-bounce', handler);
        },
    },

    // Web3 / Ethereum Integration
    web3: {
        executeTransaction: (data: unknown) => ipcRenderer.invoke('web3:execute-transaction', data),
        getProviderMetadata: () => ipcRenderer.invoke('web3:get-provider-metadata'),
        setRpcUrl: (rpcUrl: string | null) => ipcRenderer.invoke('web3:set-rpc-url', rpcUrl),
        getBalance: (address: string) => ipcRenderer.invoke('web3:get-balance', address)
    },

    // Pinata / IPFS Integration
    pinata: {
        uploadFile: (file: number[], filename: string) => ipcRenderer.invoke('web3:pinata-upload', { file, filename })
    },

    // IndiiRemote
    remote: {
        onMessageFromMobile: (callback: (data: unknown) => void) => {
            const handler = (_event: unknown, data: unknown) => callback(data);
            ipcRenderer.on('indii-remote:message-from-mobile', handler);
            return () => ipcRenderer.removeListener('indii-remote:message-from-mobile', handler);
        },
        broadcast: (payload: unknown) => ipcRenderer.send('mobile-remote:broadcast', payload),
        getMobileRemoteInfo: () => ipcRenderer.invoke('system:getMobileRemoteInfo'),
        stop: () => ipcRenderer.invoke('mobile-remote:stop'),
    },

    // Auto-Updater
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        install: () => ipcRenderer.invoke('updater:install'),
        setChannel: (channel: 'stable' | 'beta') => ipcRenderer.invoke('updater:set-channel', channel),
        setSource: (source: 'github' | 'firebase') => ipcRenderer.invoke('updater:set-source', source),
        getConfig: () => ipcRenderer.invoke('updater:get-config'),
        onChecking: (callback: () => void) => {
            ipcRenderer.on('updater:checking', callback);
            return () => ipcRenderer.removeListener('updater:checking', callback);
        },
        onAvailable: (callback: (info: unknown) => void) => {
            const handle = (_e: unknown, info: unknown) => callback(info);
            ipcRenderer.on('updater:available', handle);
            return () => ipcRenderer.removeListener('updater:available', handle);
        },
        onNotAvailable: (callback: () => void) => {
            ipcRenderer.on('updater:not-available', callback);
            return () => ipcRenderer.removeListener('updater:not-available', callback);
        },
        onProgress: (callback: (data: unknown) => void) => {
            const handle = (_e: unknown, data: unknown) => callback(data);
            ipcRenderer.on('updater:progress', handle);
            return () => ipcRenderer.removeListener('updater:progress', handle);
        },
        onDownloaded: (callback: (info: unknown) => void) => {
            const handle = (_e: unknown, info: unknown) => callback(info);
            ipcRenderer.on('updater:downloaded', handle);
            return () => ipcRenderer.removeListener('updater:downloaded', handle);
        },
        onError: (callback: (err: unknown) => void) => {
            const handle = (_e: unknown, err: unknown) => callback(err);
            ipcRenderer.on('updater:error', handle);
            return () => ipcRenderer.removeListener('updater:error', handle);
        }
    },

    testAgent: (query?: string) => ipcRenderer.invoke('test:browser-agent', query),

    // Built-in Task Scheduler
    scheduler: {
        register: (request: unknown) => ipcRenderer.invoke('scheduler:register', request),
        cancel: (taskId: string) => ipcRenderer.invoke('scheduler:cancel', taskId),
        setEnabled: (taskId: string, enabled: boolean) => ipcRenderer.invoke('scheduler:set-enabled', taskId, enabled),
        status: () => ipcRenderer.invoke('scheduler:status'),
        get: (taskId: string) => ipcRenderer.invoke('scheduler:get', taskId),
        /** Subscribe to scheduler tick events (all tasks). Returns an unsubscribe fn. */
        onTick: (callback: (event: unknown) => void) => {
            const handler = (_e: unknown, event: unknown) => callback(event);
            ipcRenderer.on('scheduler:tick', handler);
            return () => ipcRenderer.removeListener('scheduler:tick', handler);
        },
        /** Subscribe to Neural Sync pulses specifically. Returns an unsubscribe fn. */
        onNeuralSync: (callback: (payload: unknown) => void) => {
            const handler = (_e: unknown, payload: unknown) => callback(payload);
            ipcRenderer.on('scheduler:neural-sync', handler);
            return () => ipcRenderer.removeListener('scheduler:neural-sync', handler);
        },
    },

    // DAW Integration
    daw: {
        start: () => ipcRenderer.invoke('daw:start'),
        stop: () => ipcRenderer.invoke('daw:stop'),
        getState: () => ipcRenderer.invoke('daw:get-state'),
        onStateChanged: (callback: (state: unknown) => void) => {
            const handler = (_event: unknown, state: unknown) => callback(state);
            ipcRenderer.on('daw:state-changed', handler);
            return () => ipcRenderer.removeListener('daw:state-changed', handler);
        }
    },

    // AI Sidecar
    sidecar: {
        // NOTE: restart handler removed from main process — do not expose orphaned IPC
        onStatusUpdate: (callback: (status: string) => void) => {
            const handle = (_e: unknown, status: string) => callback(status);
            ipcRenderer.on('sidecar:status-update', handle);
            return () => ipcRenderer.removeListener('sidecar:status-update', handle);
        }
    },

    // Power Monitor
    power: {
        getState: () => ipcRenderer.invoke('power:get-state'),
        onBattery: (callback: () => void) => {
            ipcRenderer.on('power:on-battery', callback);
            return () => ipcRenderer.removeListener('power:on-battery', callback);
        },
        onAC: (callback: () => void) => {
            ipcRenderer.on('power:on-ac', callback);
            return () => ipcRenderer.removeListener('power:on-ac', callback);
        }
    },

    // Window control (Sleep/Wake) — hide to tray on sleep, show on wake.
    window: {
        show: () => ipcRenderer.invoke('window:show'),
        hide: () => ipcRenderer.invoke('window:hide'),
    },

    // Menu events
    menu: {
        onSaveTriggered: (callback: () => void) => {
            const handler = () => callback();
            ipcRenderer.on('menu:save-triggered', handler);
            return () => ipcRenderer.removeListener('menu:save-triggered', handler);
        }
    },

    // Safe Local Trash
    trash: {
        move: (req: { approvedFolderId: string; dirPath: string; relativePath: string; trashId: string }) =>
            ipcRenderer.invoke('trash:move', req),
        restore: (req: { dirPath: string; trashId: string; relativePath: string; targetRelativePath?: string }) =>
            ipcRenderer.invoke('trash:restore', req),
        purge: (req: { dirPath: string; trashId: string }) =>
            ipcRenderer.invoke('trash:purge', req),
    }
});
