/**
 * clickhouseClient — read-only access to the Growth Intelligence warehouse.
 *
 * Talks to ClickHouse's HTTP interface directly. No driver dependency: the
 * protocol is a POST with SQL in the body, and adding a client library to the
 * Functions bundle to save that is not a trade worth making.
 *
 * Two safety properties this module is responsible for:
 *
 *  1. **No SQL injection.** Callers never interpolate values into SQL. They
 *     pass ClickHouse-typed bind parameters, which travel as `param_*` form
 *     fields and are substituted server-side by the `{name:Type}` placeholders.
 *
 *  2. **No writes.** The credentials belong to a read-only role, and
 *     `readonly=1` is sent on every request so a malformed query fails loudly
 *     instead of mutating the warehouse. Ingestion is Airbyte's job.
 *
 * @see warehouse/README.md
 */

import { logger } from 'firebase-functions/v2';

import {
    clickhouseHost, clickhousePassword, clickhouseUsername,
    clickhouseWriterPassword, clickhouseWriterUsername,
} from '../config/secrets';

/** ClickHouse types permitted in bind parameters. */
export type ClickHouseParamType = 'String' | 'UInt32' | 'Date' | 'DateTime' | 'Array(String)';

export interface ClickHouseParam {
    type: ClickHouseParamType;
    value: string | number | readonly string[];
}

/**
 * ClickHouse expects array parameters as a bracketed list of single-quoted
 * literals — `['a','b']` — which is not JSON. Serializing with JSON.stringify
 * produces double quotes and silently yields an empty match set.
 */
function serializeParam(param: ClickHouseParam): string {
    if (Array.isArray(param.value)) {
        const escaped = param.value.map(item => `'${String(item).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
        return `[${escaped.join(',')}]`;
    }
    return String(param.value);
}

export class ClickHouseError extends Error {
    constructor(
        readonly code: 'WAREHOUSE_NOT_CONFIGURED' | 'QUERY_FAILED',
        message: string,
    ) {
        super(message);
        this.name = 'ClickHouseError';
    }
}

/** Injectable for tests. Defaults to global fetch (Node 22 runtime). */
export type WarehouseFetch = (url: string, init: RequestInit) => Promise<Response>;

interface ClickHouseJsonResponse<TRow> {
    data?: TRow[];
}

const QUERY_TIMEOUT_SECONDS = 20;

/**
 * Reads a secret, preferring the process env so the emulator and local test
 * runs work without Secret Manager access. Mirrors the accessor style used
 * elsewhere in config/secrets.ts.
 */
function readSecret(name: string, accessor: { value: () => string }): string {
    const fromEnv = process.env[name];
    if (fromEnv && fromEnv.trim().length > 0) return fromEnv;

    try {
        const value = accessor.value();
        if (value && value.trim().length > 0) return value;
    } catch {
        // Secret Manager unavailable (local run) — fall through to the throw.
    }

    throw new ClickHouseError(
        'WAREHOUSE_NOT_CONFIGURED',
        `Analytics warehouse is not configured: ${name} is unset. See warehouse/README.md.`,
    );
}

/**
 * Runs a read-only query and returns typed rows.
 *
 * @param sql    SQL using `{name:Type}` placeholders — never string-concatenated values.
 * @param params Bind parameters matching those placeholders.
 */
export async function queryWarehouse<TRow>(
    sql: string,
    params: Record<string, ClickHouseParam> = {},
    fetcher: WarehouseFetch = fetch,
): Promise<TRow[]> {
    const host = readSecret('CLICKHOUSE_HOST', clickhouseHost);
    const username = readSecret('CLICKHOUSE_USERNAME', clickhouseUsername);
    const password = readSecret('CLICKHOUSE_PASSWORD', clickhousePassword);

    const body = new URLSearchParams({
        query: `${sql.trim()} FORMAT JSON`,
        // Defence in depth alongside the read-only role: ClickHouse refuses any
        // statement that would write, even if the role is later widened.
        readonly: '1',
        max_execution_time: String(QUERY_TIMEOUT_SECONDS),
    });

    for (const [name, param] of Object.entries(params)) {
        body.set(`param_${name}`, serializeParam(param));
    }

    const response = await fetcher(`https://${host}:8443/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-ClickHouse-User': username,
            'X-ClickHouse-Key': password,
        },
        body: body.toString(),
    });

    if (!response.ok) {
        // ClickHouse returns its diagnostics as plain text. It can echo the
        // query, so it is logged for operators but never returned to a client.
        const detail = await response.text().catch(() => '');
        logger.error('[clickhouseClient] Query failed', { status: response.status, detail: detail.slice(0, 2000) });
        throw new ClickHouseError('QUERY_FAILED', `Analytics query failed with HTTP ${response.status}.`);
    }

    const parsed = await response.json() as ClickHouseJsonResponse<TRow>;
    return parsed.data ?? [];
}

/**
 * Inserts rows using the INSERT-only writer role.
 *
 * JSONEachRow is used rather than VALUES so that column order is carried by
 * each object's keys — a warehouse column added later cannot silently shift
 * every value one position to the left.
 *
 * Callers must batch. See `conversionEventOutbox` for why single-row inserts
 * are not an option with MergeTree.
 *
 * @param table Fully-qualified target, e.g. `indii_analytics.omnichannel_events`.
 * @param rows  Already-validated, warehouse-shaped rows.
 */
export async function insertWarehouseRows(
    table: string,
    rows: ReadonlyArray<Record<string, unknown>>,
    fetcher: WarehouseFetch = fetch,
): Promise<void> {
    if (rows.length === 0) return;

    const host = readSecret('CLICKHOUSE_HOST', clickhouseHost);
    const username = readSecret('CLICKHOUSE_WRITER_USERNAME', clickhouseWriterUsername);
    const password = readSecret('CLICKHOUSE_WRITER_PASSWORD', clickhouseWriterPassword);

    const url = new URL(`https://${host}:8443/`);
    url.searchParams.set('query', `INSERT INTO ${table} FORMAT JSONEachRow`);

    const response = await fetcher(url.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-ndjson',
            'X-ClickHouse-User': username,
            'X-ClickHouse-Key': password,
        },
        body: rows.map(row => JSON.stringify(row)).join('\n'),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        logger.error('[clickhouseClient] Insert failed', {
            table, rowCount: rows.length, status: response.status, detail: detail.slice(0, 2000),
        });
        throw new ClickHouseError('QUERY_FAILED', `Warehouse insert failed with HTTP ${response.status}.`);
    }
}

/** Secrets every function issuing warehouse reads must declare. */
export const WAREHOUSE_SECRETS = [clickhouseHost, clickhouseUsername, clickhousePassword];

/** Secrets the outbox flusher must declare — host plus the INSERT-only role. */
export const WAREHOUSE_WRITER_SECRETS = [clickhouseHost, clickhouseWriterUsername, clickhouseWriterPassword];
