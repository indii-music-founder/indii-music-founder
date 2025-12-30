```javascript
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Box, Package, Play, Send, ChevronRight, Info, ShoppingBag, Ruler, Palette, Truck, DollarSign } from 'lucide-react';
import { BananaTheme } from '../themes';
import { ShowroomService } from '@/services/showroom/ShowroomService';
import { useToast } from '@/core/context/ToastContext';

interface ManufacturingPanelProps {
    theme: BananaTheme;
    onClose?: () => void;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const COLORS = [
    { name: 'Midnight Black', hex: '#000000' },
    { name: 'Arctic White', hex: '#ffffff' },
    { name: 'Heather Grey', hex: '#808080' },
    { name: 'Navy Blue', hex: '#000080' },
];

export default function ManufacturingPanel({ theme, onClose }: ManufacturingPanelProps) {
    const [selectedSize, setSelectedSize] = React.useState('L');
    const [selectedColor, setSelectedColor] = React.useState(COLORS[0]);
    const toast = useToast();

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex items-center gap-3 mb-6">
                <div className={`h - 8 w - 1 rounded - full bg - gradient - to - b ${ theme.name === 'Pro' ? 'from-green-400 to-emerald-600' : 'from-yellow-400 to-orange-500' } `} />
                <h2 className={`text - xl font - bold tracking - tight ${ theme.colors.text } `}>Production</h2>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                {/* Brand Selection */}
                <section>
                    <label className={`text - xs font - medium uppercase tracking - wider mb - 3 block flex items - center gap - 2 ${ theme.colors.textSecondary } `}>
                        <ShoppingBag className="w-3 h-3" />
                        Garment Base
                    </label>
                    <div className={`p - 4 rounded - xl border transition - colors cursor - pointer group ${ theme.colors.surfaceHighlight } ${ theme.colors.border } hover: border - yellow - 400 / 50`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className={`font - medium ${ theme.colors.text } `}>Bella+Canvas 3001</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/20">
                                Premium
                            </span>
                        </div>
                        <p className={`text - xs leading - relaxed ${ theme.colors.textSecondary } `}>
                            Unisex Jersey Short Sleeve Tee. 100% Airlume combed and ring-spun cotton.
                        </p>
                    </div>
                </section>

                {/* Color Selection */}
                <section>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                        <Palette className="w-3 h-3" />
                        Base Color
                    </label>
                    <div className="flex gap-3">
                        {COLORS.map((color) => (
                            <motion.button
                                key={color.name}
                                onClick={() => setSelectedColor(color)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                className={`w - 8 h - 8 rounded - full border - 2 transition - all ${
    selectedColor.name === color.name
    ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]'
    : 'border-transparent opacity-70 hover:opacity-100'
} `}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            />
                        ))}
                    </div>
                </section>

                {/* Size Selection */}
                <section>
                    <label className={`text - xs font - medium uppercase tracking - wider mb - 3 block flex items - center gap - 2 ${ theme.colors.textSecondary } `}>
                        <Ruler className="w-3 h-3" />
                        Size Run
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {SIZES.map((size) => (
                            <button
                                key={size}
                                onClick={() => setSelectedSize(size)}
                                className={`
py - 2 rounded - lg text - xs font - medium border transition - all
                                    ${
    selectedSize === size
    ? 'bg-yellow-400 text-black border-yellow-400'
    : `${theme.colors.surfaceHighlight} ${theme.colors.textSecondary} ${theme.colors.border} hover:bg-white/20 hover:text-white`
}
`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Cost Estimation */}
                <div className={`p - 4 rounded - xl border mt - auto ${ theme.colors.background } ${ theme.colors.border } `}>
                    <div className="flex justify-between items-center mb-2">
                        <span className={`${ theme.colors.textSecondary } text - xs`}>Unit Cost</span>
                        <span className={`${ theme.colors.text } font - mono`}>$12.50</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                        <span className={`${ theme.colors.textSecondary } text - xs`}>Suggested Retail</span>
                        <span className="text-green-500 font-mono">$28.00</span>
                    </div>
                    <div className={`h - px w - full mb - 4 ${ theme.colors.border } `} />
                    <div className="flex justify-between items-center">
                        <span className={`${ theme.colors.text } font - medium text - sm`}>Est. Profit</span>
                        <span className="text-green-500 font-bold font-mono text-lg flex items-center">
                            <DollarSign className="w-4 h-4" />
                            15.50
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                        toast.showInfo("Requesting physical sample...");
                        await new Promise(r => setTimeout(r, 1000));
                        toast.showSuccess("Sample request sent to warehouse!");
                        onClose?.();
                    }}
                    className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-white/10 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                    <Truck className="w-4 h-4" />
                    Order Sample
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                        try {
                            toast.showInfo("Initializing production line...");
                            const result = await ShowroomService.submitToProduction({
                                productId: 'BETA-DESIGN-001',
                                variantId: `${ selectedSize } -${ selectedColor.name } `,
                                quantity: 100
                            });
                            if (result.success) {
                                toast.showSuccess(`Production Started! Order ID: ${ result.orderId } `);
                            }
                            onClose?.();
                        } catch (e) {
                            toast.showError("Failed to start production.");
                        }
                    }}
                    className="w-full py-3 bg-green-500 text-black rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-green-500/20 hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
                >
                    <DollarSign className="w-4 h-4" />
                    Send to Production
                </motion.button>
            </div>
        </div>
    );
}
