/**
 * CommunityWebhookService.ts
 * 
 * Dispatches automated announcements and marketing updates to Discord, Telegram, and Slack.
 * Fulfills PRODUCTION_200 item #148.
 */

import { logger } from '@/utils/logger';

export type WebhookPlatform = 'discord' | 'telegram' | 'slack';

export interface WebhookConfig {
    id: string;
    platform: WebhookPlatform;
    url: string;
    name: string; // e.g. "Discord Fan Club"
    isEnabled: boolean;
}

export interface AnnouncementPayload {
    title: string;
    message: string;
    imageUrl?: string;
    actionUrl?: string; // e.g. Pre-save Link
    authorName?: string;
}

export class CommunityWebhookService {
    /**
     * Dispatches an announcement to all enabled webhooks.
     */
    async broadcast(payload: AnnouncementPayload, configs: WebhookConfig[]): Promise<void> {
        logger.info(`[CommunityWebhook] Broadcasting to ${configs.filter(c => c.isEnabled).length} channels.`);

        const activeConfigs = configs.filter(c => c.isEnabled);

        await Promise.all(activeConfigs.map(config => this.dispatchToPlatform(payload, config)));
    }

    private async dispatchToPlatform(payload: AnnouncementPayload, config: WebhookConfig) {
        try {
            switch (config.platform) {
                case 'discord':
                    return await this.sendToDiscord(payload, config.url);
                case 'telegram':
                    return await this.sendToTelegram(payload, config.url);
                case 'slack':
                    return await this.sendToSlack(payload, config.url);
                default:
                    logger.warn(`[CommunityWebhook] Unsupported platform: ${config.platform}`);
            }
        } catch (error: any) {
            logger.error(`[CommunityWebhook] Failed to dispatch to ${config.platform}:`, error.message);
        }
    }

    private async sendToDiscord(payload: AnnouncementPayload, url: string) {
        const discordBody = {
            embeds: [{
                title: payload.title,
                description: payload.message,
                color: 0x5865F2, // Discord Blurple
                image: payload.imageUrl ? { url: payload.imageUrl } : undefined,
                footer: { text: 'Sent via indiiOS' },
                url: payload.actionUrl,
                author: payload.authorName ? { name: payload.authorName } : undefined
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordBody)
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
    }

    private async sendToTelegram(payload: AnnouncementPayload, url: string) {
        // Telegram often uses Bot API tokens, but some users use webhooks
        // This implementation assumes a standard webhook wrapper or direct bot URL
        const msg = `<b>${payload.title}</b>\n\n${payload.message}\n\n${payload.actionUrl || ''}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: msg,
                parse_mode: 'HTML',
                disable_web_page_preview: false
            })
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
    }

    private async sendToSlack(payload: AnnouncementPayload, url: string) {
        const slackBody = {
            text: `*${payload.title}*\n${payload.message}\n<${payload.actionUrl}|View Details>`,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackBody)
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);
    }
}

export const communityWebhookService = new CommunityWebhookService();
