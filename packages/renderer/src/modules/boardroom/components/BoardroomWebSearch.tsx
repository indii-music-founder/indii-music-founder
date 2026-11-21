import { Fragment, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import type { WebGroundingMetadata } from '@/shared/types/ai.dto';

interface Result {
    answer: string;
    metadata: WebGroundingMetadata;
}

function sourceFor(chunk: NonNullable<WebGroundingMetadata['groundingChunks']>[number]) {
    try {
        if (!chunk.web?.uri) return undefined;
        const url = new URL(chunk.web.uri);
        if (url.protocol !== 'https:' || url.username || url.password) return undefined;
        return { url: url.href, title: chunk.web.title || url.hostname };
    } catch {
        return undefined;
    }
}

export default function BoardroomWebSearch({ initialQuery, onClose, openInBoardroom }: {
    initialQuery: string;
    onClose: () => void;
    openInBoardroom?: (url: string) => (() => void) | undefined;
}) {
    const [query, setQuery] = useState(initialQuery);
    const [result, setResult] = useState<Result>();
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const request = useRef<AbortController>();
    useEffect(() => () => request.current?.abort(), []);

    const search = async () => {
        const text = query.trim();
        if (!text || request.current) return;
        const controller = new AbortController();
        request.current = controller;
        setPending(true);
        setError('');
        setResult(undefined);

        try {
            const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
            if (controller.signal.aborted) return;
            const response = await AutonomousIntelligence.generateGroundedContent(text, { signal: controller.signal });
            if (controller.signal.aborted) return;
            const metadata = response.response.candidates?.[0]?.groundingMetadata;
            if (!metadata?.groundingChunks?.some(sourceFor)) {
                setError('Search returned no verified sources. Try another query or open the full search page.');
                return;
            }
            setResult({ answer: response.text(), metadata });
        } catch {
            if (!controller.signal.aborted) setError('Web search could not finish. Try again or open the full search page.');
        } finally {
            request.current = undefined;
            if (!controller.signal.aborted) setPending(false);
        }
    };

    const sources = result?.metadata.groundingChunks?.map(sourceFor) ?? [];
    const suggestions = result?.metadata.searchEntryPoint?.renderedContent;
    const citations = (result?.metadata.groundingSupports ?? []).flatMap(support => {
        const segment = support.segment?.text;
        if (!segment || !result) return [];
        const start = result.answer.indexOf(segment);
        const links = (support.groundingChunkIndices ?? []).filter(index => sources[index]);
        return start < 0 || links.length === 0 ? [] : [{ end: start + segment.length, links }];
    }).sort((a, b) => a.end - b.end);
    let cursor = 0;

    return (
        <section aria-label="Boardroom web search" className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4">
            <form onSubmit={event => { event.preventDefault(); void search(); }} className="flex flex-wrap items-center gap-2">
                <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search the web"
                    maxLength={500} placeholder="Search the web" className="min-w-0 flex-1 rounded bg-white/10 p-2 text-sm" />
                <button type="submit" disabled={pending || !query.trim()} className="rounded bg-indigo-600 px-3 py-2 text-sm">
                    Search
                </button>
                <button type="button" onClick={onClose} className="px-2 py-1 text-sm">Back to browser</button>
            </form>
            <a href={query.trim() ? `https://www.google.com/search?q=${encodeURIComponent(query.trim())}` : 'https://www.google.com/'}
                target="_blank" rel="noopener noreferrer" className="self-start text-xs text-indigo-200 underline">
                Open full search in a new tab
            </a>
            {pending && <p role="status" className="text-sm">Searching the web…</p>}
            {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
            {result && (
                <div className="space-y-3 text-sm">
                    <p className="whitespace-pre-wrap break-words">
                        {citations.map((citation, index) => {
                            const text = result.answer.slice(cursor, citation.end);
                            cursor = citation.end;
                            return (
                                <Fragment key={index}>
                                    {text}{citation.links.map(sourceIndex => (
                                        <sup key={sourceIndex}>
                                            <a className="ml-1 text-indigo-200 underline" href={sources[sourceIndex]?.url}
                                                target="_blank" rel="noopener noreferrer">[{sourceIndex + 1}]</a>
                                        </sup>
                                    ))}
                                </Fragment>
                            );
                        })}
                        {result.answer.slice(cursor)}
                    </p>
                    <ol className="list-decimal space-y-1 pl-5" aria-label="Search sources">
                        {sources.map((source, index) => {
                            if (!source) return null;
                            const open = openInBoardroom?.(source.url);
                            return (
                                <li key={index} value={index + 1}>
                                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-indigo-200 underline">
                                        {source.title}
                                    </a>
                                    {open && <button type="button" onClick={open} className="ml-2 text-xs underline">Open in Boardroom</button>}
                                </li>
                            );
                        })}
                    </ol>
                    {suggestions && (
                        <iframe title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox"
                            className="h-24 w-full rounded border-0"
                            srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">${DOMPurify.sanitize(suggestions, { ADD_TAGS: ['style'], FORBID_TAGS: ['meta', 'base', 'link', 'form'] })}`} />
                    )}
                </div>
            )}
        </section>
    );
}
