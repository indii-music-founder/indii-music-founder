import React, { useEffect } from 'react';
import { useStore } from '@/core/store';
import { getModuleTheme } from '@/core/themes/ModuleTheme';
import { ModuleId } from '@/core/constants';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';

export const ModuleAmbientBackground = () => {
    const { currentModule } = useStore(
        useShallow(state => ({ currentModule: state.currentModule as ModuleId }))
    );

    const theme = getModuleTheme(currentModule);

    // Apply global CSS custom properties for the module theme
    useEffect(() => {
        document.documentElement.style.setProperty('--module-accent', theme.accent);
        document.documentElement.style.setProperty('--module-bg-gradient', theme.backgroundGradient);
    }, [theme.accent, theme.backgroundGradient]);

    // Dynamic background SVG string generator
    const getAmbientPattern = (type: string, opacity: number) => {
        let svg = '';

        switch (type) {
            case 'grid':
                svg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
                break;
            case 'dots':
                svg = `<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="d" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="rgba(255,255,255,${opacity})"/></pattern></defs><rect width="100%" height="100%" fill="url(#d)"/></svg>`;
                break;
            case 'noise':
                svg = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="${opacity * 0.5}"/></svg>`;
                break;
            case 'mesh':
                svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="m" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M0,0 Q50,100 100,0 M0,100 Q50,0 100,100" fill="none" stroke="rgba(255,255,255,${opacity * 0.8})" stroke-width="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`;
                break;
            case 'geometric':
                svg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="geom" width="40" height="40" patternUnits="userSpaceOnUse"><polygon points="0,0 20,40 40,0" fill="rgba(255,255,255,${opacity * 0.3})" /><polygon points="0,40 20,0 40,40" fill="rgba(255,255,255,${opacity * 0.1})" /></pattern></defs><rect width="100%" height="100%" fill="url(#geom)"/></svg>`;
                break;
            case 'waves':
            case 'particles':
            case 'vectors':
            default:
                // Default fallback to subtle grid
                svg = `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="def" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="none"/><path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="0.3"/></pattern></defs><rect width="100%" height="100%" fill="url(#def)"/></svg>`;
                break;
        }

        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentModule}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0"
                    style={{
                        background: theme.backgroundGradient,
                        mixBlendMode: (theme.ambientConfig?.blendMode || 'normal') as React.CSSProperties['mixBlendMode']
                    }}
                >
                    {theme.ambientConfig && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: getAmbientPattern(theme.ambientConfig.type, theme.ambientConfig.opacity),
                                backgroundSize: 'auto',
                                opacity: 0.6
                            }}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
