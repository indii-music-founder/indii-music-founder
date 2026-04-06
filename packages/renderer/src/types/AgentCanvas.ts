/**
 * AgentCanvas Types — Agent-to-UI Push (A2UI)
 *
 * Defines the payload model for agents pushing visual content directly
 * into the user's workspace — charts, tables, cards, and markdown.
 *
 * Inspired by OpenClaw's Canvas A2UI (`canvas.push` / `canvas.eval`).
 */

/** Supported content types for agent-pushed canvas panels. */
export type CanvasContentType = 'chart' | 'table' | 'card' | 'html' | 'markdown';

/** Chart type hints for structured chart rendering. */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar';

/** A single data point for chart rendering. */
export interface ChartDataPoint {
    [key: string]: string | number;
}

/** Structured chart data payload. */
export interface ChartPayload {
    chartType: ChartType;
    data: ChartDataPoint[];
    xKey: string;
    yKeys: string[];
    colors?: string[];
}

/** Structured table data payload. */
export interface TablePayload {
    columns: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>;
    rows: Array<Record<string, string | number | boolean>>;
}

/** Structured card data payload. */
export interface CardPayload {
    cards: Array<{
        title: string;
        value: string | number;
        subtitle?: string;
        icon?: string;
        trend?: 'up' | 'down' | 'stable';
        trendValue?: string;
    }>;
}

/** Markdown payload. */
export interface MarkdownPayload {
    content: string;
}

/** Union of all canvas data payloads. */
export type CanvasData = ChartPayload | TablePayload | CardPayload | MarkdownPayload | Record<string, unknown>;

/** A single canvas push payload from an agent. */
export interface CanvasPushPayload {
    /** Unique panel identifier. */
    id: string;
    /** Content type determines how the data is rendered. */
    type: CanvasContentType;
    /** Human-readable title, e.g. "Release Performance Dashboard". */
    title: string;
    /** Structured data payload, typed by `type`. */
    data: CanvasData;
    /** The agent that pushed this content. */
    agentId: string;
    /** Timestamp when the panel was pushed. */
    createdAt: number;
}
