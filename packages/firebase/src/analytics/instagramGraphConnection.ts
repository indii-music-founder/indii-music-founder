export const META_GRAPH_API_BASE = 'https://graph.facebook.com/v23.0';

export interface InstagramPageOption {
    facebookPageId: string;
    facebookPageName: string;
    instagramBusinessAccountId: string;
    instagramUsername?: string;
}

export interface FacebookInstagramConnection {
    accessToken: string;
    expiresIn: number;
    facebookPageId: string;
    igUserId: string;
    instagramUsername?: string;
}

export interface FacebookInstagramResolution {
    accessToken: string;
    expiresIn: number;
    pages: InstagramPageOption[];
}

export class MetaInstagramConnectionError extends Error {
    constructor(
        readonly code: 'META_TOKEN_EXCHANGE_FAILED' | 'NO_LINKED_INSTAGRAM_BUSINESS_ACCOUNT' | 'PAGE_SELECTION_REQUIRED' | 'INVALID_FACEBOOK_PAGE_SELECTION',
        message: string,
        readonly pages: InstagramPageOption[] = [],
    ) {
        super(message);
        this.name = 'MetaInstagramConnectionError';
    }
}

interface FetchResponse {
    ok: boolean;
    json(): Promise<unknown>;
    text(): Promise<string>;
}

export type GraphFetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

interface GraphTokenResponse {
    access_token?: string;
    expires_in?: number;
}

interface FacebookPageResponse {
    data?: Array<{
        id?: string;
        name?: string;
        instagram_business_account?: { id?: string; username?: string };
    }>;
}

function graphUrl(path: string, params: Record<string, string>): string {
    const url = new URL(path.replace(/^\//, ''), `${META_GRAPH_API_BASE}/`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
}

async function readGraphToken(fetcher: GraphFetcher, url: string, stage: string): Promise<GraphTokenResponse> {
    const response = await fetcher(url);
    if (!response.ok) {
        throw new MetaInstagramConnectionError('META_TOKEN_EXCHANGE_FAILED', `Meta ${stage} failed. Reconnect Instagram and try again.`);
    }
    const body = await response.json() as GraphTokenResponse;
    if (!body.access_token) {
        throw new MetaInstagramConnectionError('META_TOKEN_EXCHANGE_FAILED', `Meta ${stage} returned no access token.`);
    }
    return body;
}

function linkedPageOptions(body: FacebookPageResponse): InstagramPageOption[] {
    return (body.data ?? []).flatMap(page => {
        const account = page.instagram_business_account;
        if (!page.id || !page.name || !account?.id) return [];
        return [{
            facebookPageId: page.id,
            facebookPageName: page.name,
            instagramBusinessAccountId: account.id,
            ...(account.username ? { instagramUsername: account.username } : {}),
        }];
    });
}

/**
 * Resolves Facebook Login into the Page-linked Instagram professional account
 * used by the Graph content-publishing endpoints. It never returns a token to
 * the browser; callers persist the result server-side only.
 */
export async function exchangeFacebookInstagramConnection(
    input: { code: string; redirectUri: string; appId: string; appSecret: string; facebookPageId?: string },
    fetcher: GraphFetcher = fetch,
): Promise<FacebookInstagramConnection> {
    const resolution = await resolveFacebookInstagramConnection(input, fetcher);
    if (!input.facebookPageId && resolution.pages.length > 1) {
        throw new MetaInstagramConnectionError('PAGE_SELECTION_REQUIRED', 'Choose the Facebook Page connected to the Instagram account to publish from.', resolution.pages);
    }
    const selected = input.facebookPageId
        ? resolution.pages.find(page => page.facebookPageId === input.facebookPageId)
        : resolution.pages[0];
    if (!selected) {
        throw new MetaInstagramConnectionError('INVALID_FACEBOOK_PAGE_SELECTION', 'The selected Facebook Page is not linked to an authorized Instagram professional account.', resolution.pages);
    }
    return {
        accessToken: resolution.accessToken,
        expiresIn: resolution.expiresIn,
        facebookPageId: selected.facebookPageId,
        igUserId: selected.instagramBusinessAccountId,
        ...(selected.instagramUsername ? { instagramUsername: selected.instagramUsername } : {}),
    };
}

/** Resolve the token and Page options without exposing the token to a client. */
export async function resolveFacebookInstagramConnection(
    input: { code: string; redirectUri: string; appId: string; appSecret: string },
    fetcher: GraphFetcher = fetch,
): Promise<FacebookInstagramResolution> {
    const shortLived = await readGraphToken(fetcher, graphUrl('/oauth/access_token', {
        client_id: input.appId,
        client_secret: input.appSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
    }), 'authorization-code exchange');
    const longLived = await readGraphToken(fetcher, graphUrl('/oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: input.appId,
        client_secret: input.appSecret,
        fb_exchange_token: shortLived.access_token!,
    }), 'long-lived token exchange');
    const pagesResponse = await fetcher(graphUrl('/me/accounts', {
        fields: 'id,name,instagram_business_account{id,username}',
        access_token: longLived.access_token!,
    }));
    if (!pagesResponse.ok) {
        throw new MetaInstagramConnectionError('META_TOKEN_EXCHANGE_FAILED', 'Meta Page lookup failed. Reconnect Instagram and try again.');
    }
    const pages = linkedPageOptions(await pagesResponse.json() as FacebookPageResponse);
    if (pages.length === 0) {
        throw new MetaInstagramConnectionError('NO_LINKED_INSTAGRAM_BUSINESS_ACCOUNT', 'No Facebook Page linked to an Instagram professional account was found.');
    }
    return {
        accessToken: longLived.access_token!,
        expiresIn: longLived.expires_in ?? 5_184_000,
        pages,
    };
}
