import React from 'react';
import type { CatalogIntelligenceReport } from '@indii/shared';

export type CanonicalCatalogIntelligenceStatus = 'loading' | 'ready' | 'unavailable';

interface CanonicalCatalogIntelligenceSummaryProps {
    status: CanonicalCatalogIntelligenceStatus;
    report: CatalogIntelligenceReport | null;
}

export function CanonicalCatalogIntelligenceSummary({ status, report }: CanonicalCatalogIntelligenceSummaryProps) {
    if (status === 'loading') {
        return <p role="status" className="text-[11px] text-gray-500">Checking canonical catalog records…</p>;
    }

    if (status === 'unavailable' || !report) {
        return <p role="status" className="text-[11px] text-gray-500">
            Canonical review is unavailable. Your existing catalog remains unchanged.
        </p>;
    }

    let summary: string;
    if (report.metrics.entityCount === 0) {
        summary = 'No canonical records are available yet. Legacy tracks have not been migrated, so this scan cannot assess catalog coverage.';
    } else if (report.metrics.findingCount > 0) {
        summary = `${report.metrics.findingCount} possible canonical identifier conflict${report.metrics.findingCount === 1 ? ' needs' : 's need'} human review.`;
    } else {
        summary = 'No possible identifier collisions were observed in the available canonical snapshot.';
    }

    return (
        <div className="space-y-1" role="status">
            <p className="text-[11px] text-gray-500">{summary}</p>
            <p className="text-[10px] leading-relaxed text-gray-600">
                This is separate from the legacy catalog. Coverage is not verified complete; findings are review-only and do not change rights or canonical state.
                {report.snapshot.completeness === 'PARTIAL' && ' The bounded scan may omit additional canonical records.'}
            </p>
        </div>
    );
}
