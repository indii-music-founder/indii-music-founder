import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    isOrganizationAccessModule,
    type OrganizationAccessModule,
} from '@indii/shared';
import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@/core/store';
import {
    OrganizationAccessService,
    type OrganizationAccessMatrix,
    type OrganizationAccessRow,
    type UpdateOrganizationAccessInput,
} from '@/services/security/OrganizationAccessService';
import { logger } from '@/utils/logger';

type AccessStatus = 'idle' | 'loading' | 'ready' | 'error';

interface OrganizationAccessContextValue {
    activeOrganizationId: string | null;
    status: AccessStatus;
    error: string | null;
    matrix: OrganizationAccessMatrix | null;
    currentMember: OrganizationAccessRow | null;
    isControlledModule: (moduleId: string) => moduleId is OrganizationAccessModule;
    canAccessModule: (moduleId: string) => boolean;
    refresh: () => Promise<void>;
    updateMember: (input: Omit<UpdateOrganizationAccessInput, 'orgId'>) => Promise<OrganizationAccessRow>;
}

const defaultContext: OrganizationAccessContextValue = {
    activeOrganizationId: null,
    status: 'idle',
    error: null,
    matrix: null,
    currentMember: null,
    isControlledModule: isOrganizationAccessModule,
    canAccessModule: () => true,
    refresh: async () => undefined,
    updateMember: async () => {
        throw new Error('Organization access provider is unavailable.');
    },
};

const OrganizationAccessContext = createContext<OrganizationAccessContextValue>(defaultContext);

export function OrganizationAccessProvider({ children }: { children: ReactNode }) {
    const { userId, currentOrganizationId, organizations } = useStore(
        useShallow(state => ({
            userId: state.user?.uid ?? null,
            currentOrganizationId: state.currentOrganizationId,
            organizations: state.organizations ?? [],
        })),
    );
    const activeOrganization = useMemo(
        () => organizations.find(organization => organization.id === currentOrganizationId) ?? null,
        [currentOrganizationId, organizations],
    );
    const activeOrganizationId = userId && activeOrganization ? activeOrganization.id : null;
    const [status, setStatus] = useState<AccessStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [matrix, setMatrix] = useState<OrganizationAccessMatrix | null>(null);
    const requestGeneration = useRef(0);

    const refresh = useCallback(async () => {
        const generation = ++requestGeneration.current;
        if (!activeOrganizationId) {
            setStatus('idle');
            setError(null);
            setMatrix(null);
            return;
        }
        setStatus('loading');
        setError(null);
        try {
            const nextMatrix = await OrganizationAccessService.getMatrix(activeOrganizationId);
            if (generation !== requestGeneration.current) return;
            setMatrix(nextMatrix);
            setStatus('ready');
        } catch (loadError) {
            if (generation !== requestGeneration.current) return;
            const message = loadError instanceof Error
                ? loadError.message
                : 'Organization permissions could not be verified.';
            logger.error('[OrganizationAccess] Permission load failed', {
                orgId: activeOrganizationId,
                message,
            });
            setMatrix(null);
            setError(message);
            setStatus('error');
        }
    }, [activeOrganizationId]);

    useEffect(() => {
        const refreshTimer = window.setTimeout(() => {
            void refresh();
        }, 0);
        return () => {
            window.clearTimeout(refreshTimer);
            requestGeneration.current += 1;
        };
    }, [refresh]);

    const currentMember = useMemo(
        () => matrix?.members.find(member => member.userId === matrix.viewerUserId) ?? null,
        [matrix],
    );

    const canAccessModule = useCallback((moduleId: string): boolean => {
        if (!isOrganizationAccessModule(moduleId)) return true;
        if (!activeOrganizationId) return true;
        if (status !== 'ready' || !currentMember) return false;
        return currentMember.allowedModules.includes(moduleId);
    }, [activeOrganizationId, currentMember, status]);

    const updateMember = useCallback(async (
        input: Omit<UpdateOrganizationAccessInput, 'orgId'>,
    ): Promise<OrganizationAccessRow> => {
        if (!activeOrganizationId || !matrix?.canManage) {
            throw new Error('Only the organization owner can change access.');
        }
        const updated = await OrganizationAccessService.updateMember({
            orgId: activeOrganizationId,
            ...input,
        } as UpdateOrganizationAccessInput);
        setMatrix(current => current ? {
            ...current,
            members: current.members.map(member => member.userId === updated.userId ? updated : member),
        } : current);
        return updated;
    }, [activeOrganizationId, matrix?.canManage]);

    const value = useMemo<OrganizationAccessContextValue>(() => ({
        activeOrganizationId,
        status,
        error,
        matrix,
        currentMember,
        isControlledModule: isOrganizationAccessModule,
        canAccessModule,
        refresh,
        updateMember,
    }), [
        activeOrganizationId,
        status,
        error,
        matrix,
        currentMember,
        canAccessModule,
        refresh,
        updateMember,
    ]);

    return (
        <OrganizationAccessContext.Provider value={value}>
            {children}
        </OrganizationAccessContext.Provider>
    );
}

export function useOrganizationAccess(): OrganizationAccessContextValue {
    return useContext(OrganizationAccessContext);
}
