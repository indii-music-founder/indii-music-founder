export function resolveBrandManagerTab(targetView?: string | null): 'identity' | 'visuals' | 'release' | 'health' | 'interview' {
    const allowed = ['identity', 'visuals', 'release', 'health', 'interview'] as const;
    return targetView && (allowed as readonly string[]).includes(targetView) ? targetView as typeof allowed[number] : 'visuals';
}

export function resolveTouringTab(targetView?: string | null): 'planning' | 'on-the-road' | 'rider' | 'route-optimizer' | 'tech-rider' | 'setlist' | 'visa' {
    const allowed = ['planning', 'on-the-road', 'rider', 'route-optimizer', 'tech-rider', 'setlist', 'visa'] as const;
    return targetView && (allowed as readonly string[]).includes(targetView) ? targetView as typeof allowed[number] : 'rider';
}

export function resolveMerchViewMode(targetView?: string | null): 'design' | 'showroom' {
    return targetView === 'showroom' ? 'showroom' : 'design';
}
