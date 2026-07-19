export function resolveBrandManagerTab(targetView?: string | null): 'identity' | 'visuals' | 'release' | 'health' | 'interview' {
    const allowed = ['identity', 'visuals', 'release', 'health', 'interview'] as const;
    return targetView && (allowed as readonly string[]).includes(targetView) ? targetView as typeof allowed[number] : 'visuals';
}

export function resolveTouringTab(targetView?: string | null): 'plan' | 'tour-book' | 'on-the-road' | 'insights' {
    const allowed = ['plan', 'tour-book', 'on-the-road', 'insights'] as const;
    return targetView && (allowed as readonly string[]).includes(targetView) ? targetView as typeof allowed[number] : 'plan';
}

export function resolveMerchViewMode(targetView?: string | null): 'design' | 'showroom' {
    return targetView === 'showroom' ? 'showroom' : 'design';
}
