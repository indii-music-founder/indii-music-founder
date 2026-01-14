import React from 'react';
import { motion } from 'framer-motion';

interface SonicRadarProps {
    features: {
        energy: number;
        danceability: number;
        happiness: number; // mapped from valence
        acousticness: number;
        instrumentalness: number;
    };
    loading?: boolean;
}

export const SonicRadar: React.FC<SonicRadarProps> = ({ features, loading }) => {
    // Normalize values 0-1
    const data = [
        { label: 'ENERGY', value: features.energy, angle: 0 },
        { label: 'DANCE', value: features.danceability, angle: 72 },
        { label: 'MOOD', value: features.happiness, angle: 144 },
        { label: 'ACOUSTIC', value: features.acousticness, angle: 216 },
        { label: 'INSTR', value: features.instrumentalness, angle: 288 },
    ];

    const radius = 100;
    const center = 120;

    // Helper to get coordinates
    const getPoint = (value: number, angle: number) => {
        const rad = (angle - 90) * (Math.PI / 180);
        return {
            x: center + (radius * value) * Math.cos(rad),
            y: center + (radius * value) * Math.sin(rad)
        };
    };

    // Generate path for the data shape
    const pathData = data.map((d, i) => {
        const point = getPoint(loading ? 0.2 : d.value, d.angle);
        return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    }).join(' ') + ' Z';

    return (
        <div className="relative w-full aspect-square max-w-[300px] mx-auto group">
            <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible">
                {/* Background Web */}
                {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
                    <circle
                        key={i}
                        cx={center}
                        cy={center}
                        r={radius * scale}
                        fill="none"
                        stroke="currentColor"
                        className="text-white/5"
                        strokeWidth="1"
                    />
                ))}

                {/* Axis Lines */}
                {data.map((d, i) => {
                    const point = getPoint(1.1, d.angle);
                    return (
                        <g key={i}>
                            <line
                                x1={center}
                                y1={center}
                                x2={point.x}
                                y2={point.y}
                                stroke="currentColor"
                                className="text-white/10"
                                strokeWidth="1"
                            />
                            {/* Labels */}
                            <text
                                x={point.x}
                                y={point.y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="text-[10px] fill-muted-foreground font-mono tracking-wider "
                                style={{ transformOrigin: `${point.x}px ${point.y}px`, transform: `scale(${loading ? 0.8 : 1})` }}
                            >
                                {d.label}
                            </text>
                        </g>
                    );
                })}

                {/* Data Shape */}
                <motion.path
                    d={pathData}
                    fill="rgba(var(--primary-rgb), 0.2)"
                    stroke="currentColor"
                    className="text-primary drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" // Assuming yellow primary
                    strokeWidth="2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, d: pathData }}
                    transition={{
                        type: "spring",
                        stiffness: 100,
                        damping: 20
                    }}
                />

                {/* Data Points */}
                {data.map((d, i) => {
                    const point = getPoint(loading ? 0.2 : d.value, d.angle);
                    return (
                        <motion.circle
                            key={i}
                            cx={point.x}
                            cy={point.y}
                            r="3"
                            className="fill-primary"
                        />
                    );
                })}
            </svg>

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-full w-full absolute inset-0 bg-background/50 backdrop-blur-sm z-10" />
                    <div className="z-20 text-xs font-mono text-primary animate-pulse">Scanning...</div>
                </div>
            )}
        </div>
    );
};
