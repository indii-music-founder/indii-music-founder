import log from 'electron-log';
import { ipcMain } from 'electron';
import { z } from 'zod';
import { FetchUrlSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { validateSafeUrlAsync } from '../utils/network-security';
export { validateSafeUrlAsync };

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FETCH_BYTES = 25 * 1024 * 1024;

function assertAllowedContentLength(response: Response): void {
    const rawLength = response.headers?.get?.('content-length');
    if (!rawLength) return;
    const contentLength = Number(rawLength);
    if (Number.isFinite(contentLength) && contentLength > MAX_FETCH_BYTES) {
        throw new Error(`HTTP Response too large (${contentLength} bytes exceeds ${MAX_FETCH_BYTES} byte limit)`);
    }
}

export function registerNetworkHandlers() {
    ipcMain.handle('net:fetch-url', async (event, url: string) => {
        try {
            validateSender(event);
            const validatedUrl = FetchUrlSchema.parse(url);

            log.info(`[Network] Validating Request: ${url}`);
            await validateSafeUrlAsync(validatedUrl);

            log.info(`[Network] Fetching Safe URL: ${validatedUrl}`);
            const response = await fetch(validatedUrl, {
                redirect: 'error',
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            assertAllowedContentLength(response);

            const text = await response.text();
            if (text.length > MAX_FETCH_BYTES) {
                throw new Error(`HTTP Response body exceeds ${MAX_FETCH_BYTES} byte limit`);
            }
            return text;
        } catch (error) {
            if (error instanceof z.ZodError) {
                log.error('[Network] Validation failed:', error.errors);
                throw new Error(`Invalid URL: ${error.errors[0]!.message}`);
            }
            log.error('[Network] Fetch failed:', error);
            throw new Error(`Network Request Failed: ${(error as Error).message}`);
        }
    });

    ipcMain.handle('net:fetch-url-base64', async (event, url: string) => {
        try {
            validateSender(event);
            const validatedUrl = FetchUrlSchema.parse(url);

            log.info(`[Network] Validating Base64 Request: ${url}`);
            await validateSafeUrlAsync(validatedUrl);

            log.info(`[Network] Fetching Safe URL for Base64: ${validatedUrl}`);
            const response = await fetch(validatedUrl, {
                redirect: 'error',
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            assertAllowedContentLength(response);

            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength > MAX_FETCH_BYTES) {
                throw new Error(`HTTP Response body exceeds ${MAX_FETCH_BYTES} byte limit`);
            }
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const contentType = response.headers?.get?.('content-type') || 'application/octet-stream';
            return { base64, contentType };
        } catch (error) {
            if (error instanceof z.ZodError) {
                log.error('[Network] Validation failed for base64:', error.errors);
                throw new Error(`Invalid URL: ${error.errors[0]!.message}`);
            }
            log.error('[Network] Fetch base64 failed:', error);
            throw new Error(`Network Request Failed: ${(error as Error).message}`);
        }
    });
}
