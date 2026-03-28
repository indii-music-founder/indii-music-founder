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
                svg = `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="0.5"/><path d="M 40 0 L 40 80 M 0 40 L 80 40" fill="none" stroke="rgba(255,255,255,${opacity * 0.3})" stroke-width="0.2"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
                break;
            case 'dots':
                svg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="d" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1" fill="rgba(255,255,255,${opacity})"/><circle cx="0" cy="0" r="0.5" fill="rgba(255,255,255,${opacity * 0.5})"/></pattern></defs><rect width="100%" height="100%" fill="url(#d)"/></svg>`;
                break;
            case 'noise':
                svg = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="${opacity * 0.4}"/></svg>`;
                break;
            case 'mesh':
                svg = `<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="m" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M0,60 Q30,0 60,60 T120,60 M60,0 Q90,60 120,0 M0,120 Q30,60 60,120 T120,120" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="0.5" stroke-dasharray="2 4"/></pattern></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`;
                break;
            case 'geometric':
                svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="geom" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M0,0 L50,0 L25,43.3 Z M50,0 L100,0 L75,43.3 Z M25,43.3 L75,43.3 L50,86.6 Z" fill="rgba(255,255,255,${opacity * 0.1})" stroke="rgba(255,255,255,${opacity * 0.2})" stroke-width="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#geom)"/></svg>`;
                break;
            case 'waves':
                svg = `<svg width="200" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M0,20 Q50,0 100,20 T200,20" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="1"><animate attributeName="d" values="M0,20 Q50,0 100,20 T200,20;M0,20 Q50,40 100,20 T200,20;M0,20 Q50,0 100,20 T200,20" dur="10s" repeatCount="indefinite"/></path></svg>`;
                break;
            case 'particles':
                svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="1" fill="rgba(255,255,255,${opacity})"><animate attributeName="opacity" values="0;${opacity};0" dur="3s" repeatCount="indefinite" begin="0s"/></circle><circle cx="50" cy="80" r="1.5" fill="rgba(255,255,255,${opacity})"><animate attributeName="opacity" values="0;${opacity};0" dur="4s" repeatCount="indefinite" begin="1s"/></circle><circle cx="90" cy="30" r="0.5" fill="rgba(255,255,255,${opacity})"><animate attributeName="opacity" values="0;${opacity};0" dur="5s" repeatCount="indefinite" begin="2.5s"/></circle></svg>`;
                break;
            case 'vectors':
                svg = `<svg width="150" height="150" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="v" width="150" height="150" patternUnits="userSpaceOnUse"><path d="M0,0 L10,10 M140,140 L150,150 M75,0 L75,10 M0,75 L10,75" stroke="rgba(255,255,255,${opacity})" stroke-width="1"/><circle cx="75" cy="75" r="2" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;
                break;
            default:
                svg = `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="def" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="0.3"/></pattern></defs><rect width="100%" height="100%" fill="url(#def)"/></svg>`;
                break;
        }

        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentModule}
                    initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                    style={{
                        background: theme.backgroundGradient,
                        mixBlendMode: (theme.ambientConfig?.blendMode || 'normal') as React.CSSProperties['mixBlendMode']
                    }}
                >
                    {/* SVG Pattern Layer with Drift */}
                    {theme.ambientConfig && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{
                                opacity: 0.3,
                                x: [0, 10, 0, -10, 0],
                                y: [0, -5, 0, 5, 0]
                            }}
                            transition={{
                                opacity: { delay: 0.5, duration: 2 },
                                x: { duration: 30, repeat: Infinity, ease: "linear" },
                                y: { duration: 25, repeat: Infinity, ease: "linear" }
                            }}
                            className="absolute inset-[-5%] pointer-events-none"
                            style={{
                                backgroundImage: getAmbientPattern(theme.ambientConfig.type, theme.ambientConfig.opacity),
                                backgroundSize: theme.ambientConfig.type === 'waves' ? '400px 80px' : 'auto',
                                backgroundRepeat: 'repeat',
                            }}
                        />
                    )}

                    {/* Department Identity Watermark */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 0.15, x: 0 }}
                        transition={{ delay: 1, duration: 1.5 }}
                        className="absolute bottom-12 right-12 flex flex-col items-end select-none"
                    >
                        <span
                            className="text-[10px] tracking-[0.4em] uppercase font-bold"
                            style={{ color: theme.accent }}
                        >
                            INDIIOS OFFICE
                        </span>
                        <span
                            className="text-4xl font-display tracking-tighter mt-1"
                            style={{
                                color: theme.accent,
                                textShadow: `0 0 20px ${theme.accent}44`
                            }}
                        >
                            {theme.officeName}
                        </span>
                    </motion.div>

                    {/* Scanner Beam Effect */}
                    <motion.div
                        className="absolute inset-0 h-[1px] w-full"
                        style={{
                            background: `linear-gradient(90deg, transparent, ${theme.accent}44, transparent)`,
                            top: '-5%'
                        }}
                        animate={{ top: ['-5%', '105%'] }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear",
                            delay: 2
                        }}
                    />

                    {/* Subtle vignette for focus */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)] pointer-events-none" />
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

