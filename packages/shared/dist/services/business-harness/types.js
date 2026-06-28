export function createHarnessRun(params) {
    return {
        ...params,
        schemaVersion: params.schemaVersion ?? 1,
        runId: params.runId ?? `harness_${params.domain}_${Date.now()}`,
        createdAt: params.createdAt ?? new Date().toISOString(),
    };
}
