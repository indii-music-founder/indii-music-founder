import type { User } from 'firebase/auth';

export const DEMO_USER_ID = 'founder-demo-uid';

type AuthLikeUser = Pick<User, 'uid' | 'isAnonymous'> | null | undefined;

const INVALID_USER_IDS = new Set(['', 'undefined', 'null', 'pending', 'guest', DEMO_USER_ID]);

export function isDemoUserId(uid: string | null | undefined): boolean {
    return !uid || INVALID_USER_IDS.has(uid);
}

export function isAnonymousOrDemoUser(user: AuthLikeUser): boolean {
    return !user || user.isAnonymous === true || isDemoUserId(user.uid);
}

export function getRealAuthenticatedUserId(user: AuthLikeUser): string | null {
    if (isAnonymousOrDemoUser(user)) return null;
    return user?.uid ?? null;
}

export function isRealAuthenticatedUser(user: AuthLikeUser): boolean {
    return getRealAuthenticatedUserId(user) !== null;
}
