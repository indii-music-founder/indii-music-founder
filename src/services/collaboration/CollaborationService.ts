/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { logger } from '@/utils/logger';

/**
 * Requirement 110: Real-time Collaboration Engine
 * Supports multiplayer (CRDT/Yjs) editing in both the audio waveform view and the workflow node editor.
 */

export interface CursorPosition {
    x: number;
    y: number;
    userId: string;
    userName: string;
    color: string;
}

export class CollaborationService {
    private doc: Y.Doc;
    private provider: WebsocketProvider | null = null;

    // Shared Types
    public workflowNodes: Y.Map<any>;
    public audioWaveformState: Y.Map<any>;

    constructor() {
        this.doc = new Y.Doc();

        // Define our shared data structures
        this.workflowNodes = this.doc.getMap('workflow-nodes');
        this.audioWaveformState = this.doc.getMap('audio-waveform');
    }

    /**
     * Connects to a collaborative session via WebSocket.
     * @param roomId Unique identifier for the project/session
     * @param userId The current user's ID
     * @param userName The current user's display name
     */
    public connect(roomId: string, userId: string, userName: string): void {
        try {
            // In a production environment, this URL points to your custom y-websocket server
            // For example: wss://collab.indii.os
            const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://127.0.0.1:1234';

            logger.info(`[CollaborationService] Connecting to room ${roomId} at ${wsUrl}`);

            this.provider = new WebsocketProvider(wsUrl, roomId, this.doc, {
                connect: true,
                maxBackoffTime: 2500,
            });

            this.provider.on('status', (event: { status: string }) => {
                logger.info(`[CollaborationService] Status: ${event.status}`);
            });

            // Set up Awareness (cursors, presence)
            const awareness = this.provider.awareness;

            // Assign a deterministic cursor color based on userId — same user always gets same color
            const colors = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
            const hashCode = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const userColor = colors[hashCode % colors.length];

            awareness.setLocalStateField('user', {
                id: userId,
                name: userName,
                color: userColor,
            });

            awareness.on('change', () => {
                // You can subscribe to awareness changes in React hooks to render cursors
                // const states = Array.from(awareness.getStates().values());
                // logger.debug('[CollaborationService] Awareness updated', states.length, 'users');
            });

        } catch (error: unknown) {
            logger.error('[CollaborationService] Failed to connect', error);
        }
    }

    public disconnect(): void {
        if (this.provider) {
            logger.info('[CollaborationService] Disconnecting provider...');
            this.provider.disconnect();
            this.provider.destroy();
            this.provider = null;
        }
    }

    /**
     * Updates the local user's cursor position and propagates to peers.
     */
    public updateCursor(x: number, y: number): void {
        if (!this.provider) return;
        const awareness = this.provider.awareness;
        awareness.setLocalStateField('cursor', { x, y });
    }

    /**
     * Returns the active awareness states (used by UI to render remote cursors).
     */
    public getAwarenessStates(): Record<string, any>[] {
        if (!this.provider) return [];
        return Array.from(this.provider.awareness.getStates().values());
    }

    // --- Audio Waveform Collaboration Helpers ---

    /**
     * Syncs a playback or selection region across connected clients.
     */
    public updateWaveformRegion(regionId: string, start: number, end: number): void {
        this.audioWaveformState.set(regionId, { start, end });
    }

    // --- Workflow Node Collaboration Helpers ---

    /**
     * Updates a workflow node's position collaboratively.
     */
    public updateNodePosition(nodeId: string, x: number, y: number): void {
        const currentData = this.workflowNodes.get(nodeId) || {};
        this.workflowNodes.set(nodeId, { ...currentData, position: { x, y } });
    }
}

// Singleton export
export const collaborationService = new CollaborationService();
