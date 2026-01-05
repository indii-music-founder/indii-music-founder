import React from 'react';
import { TraceViewer } from '@/components/studio/observability/TraceViewer';

export default function ObservabilityDashboard() {
    return (
        <div className="h-full w-full bg-background">
            <TraceViewer />
        </div>
    );
}
