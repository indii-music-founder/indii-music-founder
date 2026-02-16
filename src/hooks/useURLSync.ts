import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/core/store';
import { isValidModule } from '@/core/constants';

export function useURLSync() {
    const { currentModule, setModule } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    // 1. URL -> Store (Deep Link / Back Button)
    useEffect(() => {
        // Parse module from path segments (robust splitting)
        const pathSegments = location.pathname.split('/').filter(Boolean);
        const targetModule = pathSegments[0] || 'dashboard';

        // Check if it is a valid module
        if (targetModule !== currentModule && isValidModule(targetModule)) {
            setModule(targetModule);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, setModule]);

    // 2. Store -> URL (Navigation)
    useEffect(() => {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        const currentPathModule = pathSegments[0] || 'dashboard';

        // Only navigate if the module actually CHANGED from what's in the URL
        // This preserves sub-paths (e.g. /creative/123) if the module is still 'creative'
        if (currentModule !== currentPathModule) {
            const targetUrl = currentModule === 'dashboard' ? '/' : `/${currentModule}`;
            navigate(targetUrl);
        }
        // Remove location.pathname to prevent reverting URL during Back navigation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentModule, navigate]);
}
