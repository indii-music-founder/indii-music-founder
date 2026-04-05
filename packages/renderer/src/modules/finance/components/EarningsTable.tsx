import React, { useState, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ReleaseEarnings } from '@/services/revenue/schema';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionableEmptyState } from '@/components/shared/ActionableEmptyState';

interface EarningsTableProps {
    data: ReleaseEarnings[];
    pageSize?: number;
}

export const EarningsTable = React.memo(({ data, pageSize = 10 }: EarningsTableProps) => {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(data.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedData = useMemo(() =>
        data.slice(startIndex, startIndex + pageSize),
        [data, startIndex, pageSize]);

    if (data.length === 0) {
        return (
            <div className="w-full">
                <ActionableEmptyState
                    icon={<DollarSign size={48} />}
                    title="NO REVENUE LOGGED"
                    description="When your streams and digital downloads generate revenue, they will appear here in the virtual ledger."
                    colorClasses={{
                        text: 'text-dept-licensing',
                        bg: 'bg-dept-licensing/5',
                        border: 'border-dept-licensing/20',
                        glow: 'shadow-dept-licensing/10'
                    }}
                />
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px] py-4">Release</TableHead>
                            <TableHead className="text-gray-400 font-bold uppercase tracking-widest text-[10px] py-4">ISRC</TableHead>
                            <TableHead className="text-right text-gray-400 font-bold uppercase tracking-widest text-[10px] py-4">Streams</TableHead>
                            <TableHead className="text-right text-gray-400 font-bold uppercase tracking-widest text-[10px] py-4">Downloads</TableHead>
                            <TableHead className="text-right text-dept-licensing font-bold uppercase tracking-widest text-[10px] py-4">Revenue</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence mode="popLayout">
                            {paginatedData.map((row, index) => (
                                <ContextMenu.Root key={row.releaseId}>
                                    <ContextMenu.Trigger asChild>
                                        <motion.tr
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="border-white/5 hover:bg-white/10 transition-colors group cursor-default"
                                        >
                                            <TableCell className="py-4">
                                                <span className="font-bold text-white group-hover:text-dept-licensing transition-colors">
                                                    {row.releaseName}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-gray-500 font-mono text-[10px] font-bold tracking-tighter">{row.isrc || 'N/A'}</TableCell>
                                            <TableCell className="text-right text-gray-300 font-bold tabular-nums">
                                                {row.streams.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-300 font-bold tabular-nums">
                                                {row.downloads.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-black text-white bg-dept-licensing/10 px-2 py-1 rounded-lg border border-dept-licensing/20 shadow-sm">
                                                    ${row.revenue.toFixed(2)}
                                                </span>
                                            </TableCell>
                                        </motion.tr>
                                    </ContextMenu.Trigger>
                                    <ContextMenu.Portal>
                                        <ContextMenu.Content className="min-w-[160px] bg-[#1a1c20] border border-white/10 rounded-xl p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                                            <ContextMenu.Item
                                                onSelect={() => navigator.clipboard.writeText(row.isrc || '')}
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded outline-none cursor-pointer font-bold"
                                            >
                                                Copy ISRC
                                            </ContextMenu.Item>
                                            <ContextMenu.Item
                                                onSelect={() => navigator.clipboard.writeText(row.releaseName)}
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded outline-none cursor-pointer font-bold"
                                            >
                                                Copy Release Name
                                            </ContextMenu.Item>
                                            <ContextMenu.Separator className="h-px bg-white/10 my-1" />
                                            <ContextMenu.Item
                                                className="flex items-center gap-2 px-2 py-1.5 text-xs text-dept-licensing hover:bg-dept-licensing/10 rounded outline-none cursor-pointer font-bold"
                                            >
                                                View Report Details
                                            </ContextMenu.Item>
                                        </ContextMenu.Content>
                                    </ContextMenu.Portal>
                                </ContextMenu.Root>
                            ))}
                        </AnimatePresence>
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 pt-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Page {currentPage} of {totalPages} <span className="ml-2 font-mono text-gray-600">({data.length} total records)</span>
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft size={16} className="text-white" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight size={16} className="text-white" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

EarningsTable.displayName = 'EarningsTable';
