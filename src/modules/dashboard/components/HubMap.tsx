import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/constants';
import {
    Palette, Megaphone, Scale, DollarSign, Globe, Network,
    Film, Book, FileText, Briefcase, GitBranch, Users,
    Music, Shirt,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

interface HubNode {
    id: ModuleId;
    label: string;
    Icon: React.ElementType;
    color: string;
    ring: 'inner' | 'outer';
    /** Starting angle in degrees (0 = right, -90 = top) */
    angle: number;
    /** Seconds for the flow-dot to travel center → node */
    flowDur: number;
}

const NODES: HubNode[] = [
    // Inner ring — 6 nodes, 60° apart, starting at top
    { id: 'creative',     label: 'Creative',     Icon: Palette,   color: '#9C27B0', ring: 'inner', angle: -90,  flowDur: 2.4 },
    { id: 'marketing',    label: 'Marketing',    Icon: Megaphone, color: '#E91E63', ring: 'inner', angle: -30,  flowDur: 2.8 },
    { id: 'legal',        label: 'Legal',        Icon: Scale,     color: '#455A64', ring: 'inner', angle:  30,  flowDur: 3.1 },
    { id: 'finance',      label: 'Finance',      Icon: DollarSign,color: '#FFC107', ring: 'inner', angle:  90,  flowDur: 2.6 },
    { id: 'distribution', label: 'Distribution', Icon: Globe,     color: '#2196F3', ring: 'inner', angle: 150,  flowDur: 2.9 },
    { id: 'social',       label: 'Social',       Icon: Network,   color: '#00BCD4', ring: 'inner', angle: 210,  flowDur: 3.3 },

    // Outer ring — 6 nodes, 60° apart, offset +30° so they land between inner
    { id: 'video',        label: 'Video',        Icon: Film,      color: '#CE93D8', ring: 'outer', angle: -60,  flowDur: 3.8 },
    { id: 'publishing',   label: 'Publishing',   Icon: Book,      color: '#8BC34A', ring: 'outer', angle:   0,  flowDur: 4.1 },
    { id: 'licensing',    label: 'Licensing',    Icon: FileText,  color: '#009688', ring: 'outer', angle:  60,  flowDur: 3.5 },
    { id: 'brand',        label: 'Brand',        Icon: Briefcase, color: '#FFB300', ring: 'outer', angle: 120,  flowDur: 4.3 },
    { id: 'workflow',     label: 'Workflow',     Icon: GitBranch, color: '#4DD0E1', ring: 'outer', angle: 180,  flowDur: 3.9 },
    { id: 'road',         label: 'Road',         Icon: Users,     color: '#FF5722', ring: 'outer', angle: 240,  flowDur: 4.0 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rad = (deg: number) => (deg * Math.PI) / 180;

interface Pt { x: number; y: number }

function getNodePos(node: HubNode, cx: number, cy: number, innerR: number, outerR: number): Pt {
    const r = node.ring === 'inner' ? innerR : outerR;
    return {
        x: cx + r * Math.cos(rad(node.angle)),
        y: cy + r * Math.sin(rad(node.angle)),
    };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Subtle animated grid background */
function GridCanvas({ w, h }: { w: number; h: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const frame = useRef(0);

    useEffect(() => {
        const c = ref.current;
        if (!c || w === 0 || h === 0) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        c.width = w;
        c.height = h;

        let t = 0;
        const tick = () => {
            t += 0.003;
            ctx.clearRect(0, 0, w, h);
            const g = 44;
            ctx.strokeStyle = 'rgba(255,255,255,0.028)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x <= w; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
            for (let y = 0; y <= h; y += g) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
            ctx.stroke();

            // Sparse active-cell shimmer
            ctx.fillStyle = 'rgba(99,102,241,0.06)';
            for (let x = 0; x < w; x += g) {
                for (let y = 0; y < h; y += g) {
                    if (Math.sin(x * 0.07 + t * 1.3) * Math.cos(y * 0.07 + t * 0.9) > 0.92) {
                        ctx.fillRect(x + 1, y + 1, g - 2, g - 2);
                    }
                }
            }
            frame.current = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame.current);
    }, [w, h]);

    return <canvas ref={ref} className="absolute inset-0" style={{ opacity: 0.7 }} />;
}

/** Animated spoke between center and a satellite node */
function Spoke({ from, to, color, isActive, flowDur }: {
    from: Pt; to: Pt; color: string; isActive: boolean; flowDur: number;
}) {
    const pathD = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    return (
        <g>
            {/* Base line */}
            <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={color}
                strokeOpacity={isActive ? 0.55 : 0.14}
                strokeWidth={isActive ? 1.5 : 0.8}
            />
            {/* Flow dot — center → node */}
            <circle r={isActive ? 3 : 2} fill={color} opacity={isActive ? 0.9 : 0.45}>
                <animateMotion dur={`${flowDur}s`} repeatCount="indefinite" path={pathD} />
            </circle>
        </g>
    );
}

/** The center "indii" orchestrator node */
function CenterHub({ x, y, isActive, onClick }: { x: number; y: number; isActive: boolean; onClick: () => void }) {
    const S = 60;
    const half = S / 2;
    return (
        <motion.button
            className="absolute flex items-center justify-center rounded-full z-10 focus:outline-none"
            style={{
                left: x - half,
                top: y - half,
                width: S,
                height: S,
                background: 'radial-gradient(circle, rgba(99,102,241,0.9) 0%, rgba(59,130,246,0.55) 100%)',
                border: '1px solid rgba(99,102,241,0.6)',
                boxShadow: '0 0 32px rgba(99,102,241,0.35), 0 0 64px rgba(99,102,241,0.12)',
            }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClick}
            aria-label="Return to Dashboard"
        >
            <span className="text-white font-bold text-[10px] tracking-widest select-none">indii</span>

            {/* Permanent slow pulse ring */}
            <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '1px solid rgba(99,102,241,0.4)' }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
            />
            {/* Outer fast pulse ring */}
            <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '1px solid rgba(99,102,241,0.25)' }}
                animate={{ scale: [1, 2.0, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', delay: 1 }}
            />
        </motion.button>
    );
}

/** A department satellite node */
function SatelliteNode({ node, x, y, nodeSize, isActive, onClick }: {
    node: HubNode;
    x: number;
    y: number;
    nodeSize: number;
    isActive: boolean;
    onClick: () => void;
}) {
    const Icon = node.Icon;
    const iconSize = Math.round(nodeSize * 0.42);
    const buttonW = nodeSize + 52;

    return (
        <motion.button
            className="absolute flex flex-col items-center gap-1 focus:outline-none group z-10"
            style={{ left: x - buttonW / 2, top: y - nodeSize / 2, width: buttonW }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClick}
            aria-label={`Navigate to ${node.label}`}
            title={node.label}
        >
            {/* Icon circle */}
            <div
                className="relative rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                    width: nodeSize,
                    height: nodeSize,
                    background: isActive ? `${node.color}28` : `${node.color}12`,
                    border: `1px solid ${isActive ? node.color + '90' : node.color + '28'}`,
                    boxShadow: isActive ? `0 0 20px ${node.color}50, 0 0 8px ${node.color}30` : 'none',
                    color: node.color,
                }}
            >
                <Icon size={iconSize} />

                {/* Active pulse ring */}
                <AnimatePresence>
                    {isActive && (
                        <motion.div
                            className="absolute inset-0 rounded-full"
                            style={{ border: `1px solid ${node.color}50` }}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            exit={{ opacity: 0 }}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Label */}
            <span
                className="text-[9px] font-medium whitespace-nowrap leading-tight transition-colors duration-300 tracking-wide"
                style={{ color: isActive ? node.color : 'rgba(156,163,175,0.75)' }}
            >
                {node.label}
            </span>
        </motion.button>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HubMap() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    const { currentModule, setModule } = useStore(
        useShallow((s) => ({ currentModule: s.currentModule, setModule: s.setModule }))
    );

    // Track container size via ResizeObserver
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize({ w: Math.round(width), h: Math.round(height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const { w, h } = size;
    const cx = w / 2;
    const cy = h / 2;
    const minDim = Math.min(w, h);
    const innerR = minDim * 0.27;
    const outerR = minDim * 0.44;

    const innerNodeSize = Math.max(32, Math.min(48, minDim * 0.095));
    const outerNodeSize = Math.max(26, Math.min(38, minDim * 0.074));

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full rounded-xl overflow-hidden border border-white/5"
            style={{ background: '#0a0d18' }}
        >
            {/* Ambient gradient blobs */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/8 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-600/6 rounded-full blur-3xl" />
            </div>

            {/* Grid canvas */}
            {w > 0 && <GridCanvas w={w} h={h} />}

            {/* SVG layer: orbital rings + spokes */}
            {w > 0 && (
                <svg
                    className="absolute inset-0 pointer-events-none"
                    width={w}
                    height={h}
                >
                    {/* Orbital rings */}
                    <circle cx={cx} cy={cy} r={innerR} stroke="rgba(255,255,255,0.04)" strokeWidth={1} fill="none" />
                    <circle cx={cx} cy={cy} r={outerR} stroke="rgba(255,255,255,0.025)" strokeWidth={1} fill="none" />

                    {/* Spokes */}
                    {NODES.map(node => {
                        const pos = getNodePos(node, cx, cy, innerR, outerR);
                        return (
                            <Spoke
                                key={node.id}
                                from={{ x: cx, y: cy }}
                                to={pos}
                                color={node.color}
                                isActive={currentModule === node.id}
                                flowDur={node.flowDur}
                            />
                        );
                    })}
                </svg>
            )}

            {/* Center hub */}
            {w > 0 && (
                <CenterHub
                    x={cx}
                    y={cy}
                    isActive={currentModule === 'dashboard'}
                    onClick={() => setModule('dashboard')}
                />
            )}

            {/* Satellite nodes */}
            {w > 0 && NODES.map(node => {
                const pos = getNodePos(node, cx, cy, innerR, outerR);
                const ns = node.ring === 'inner' ? innerNodeSize : outerNodeSize;
                return (
                    <SatelliteNode
                        key={node.id}
                        node={node}
                        x={pos.x}
                        y={pos.y}
                        nodeSize={ns}
                        isActive={currentModule === node.id}
                        onClick={() => setModule(node.id)}
                    />
                );
            })}

            {/* Center hint text (shown when dashboard is active) */}
            <AnimatePresence>
                {currentModule === 'dashboard' && w > 0 && (
                    <motion.p
                        className="absolute pointer-events-none text-[10px] text-gray-600 font-mono tracking-widest"
                        style={{ left: cx, top: cy + 40, transform: 'translateX(-50%)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        click any department to enter
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}
