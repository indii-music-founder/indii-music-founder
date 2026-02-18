import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ReleaseEarnings } from '@/services/revenue/schema';
import { motion } from 'motion/react';

interface EarningsTableProps {
    data: ReleaseEarnings[];
}

export const EarningsTable = React.memo(({ data }: EarningsTableProps) => {
    return (
        <div className="w-full overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                    <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-gray-400 font-semibold py-4">Release</TableHead>
                        <TableHead className="text-gray-400 font-semibold py-4">ISRC</TableHead>
                        <TableHead className="text-right text-gray-400 font-semibold py-4">Streams</TableHead>
                        <TableHead className="text-right text-gray-400 font-semibold py-4">Downloads</TableHead>
                        <TableHead className="text-right text-dept-licensing font-semibold py-4">Revenue</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, index) => (
                        <motion.tr
                            key={row.releaseId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-white/5 hover:bg-white/5 transition-colors group cursor-default"
                        >
                            <TableCell className="py-5">
                                <span className="font-medium text-white group-hover:text-dept-royalties transition-colors">
                                    {row.releaseName}
                                </span>
                            </TableCell>
                            <TableCell className="text-gray-500 font-mono text-xs">{row.isrc || 'N/A'}</TableCell>
                            <TableCell className="text-right text-gray-300">
                                {row.streams.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-gray-300">
                                {row.downloads.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                                <span className="font-bold text-white bg-dept-licensing/10 px-2 py-1 rounded-md border border-dept-licensing/20">
                                    ${row.revenue.toFixed(2)}
                                </span>
                            </TableCell>
                        </motion.tr>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
});

EarningsTable.displayName = 'EarningsTable';
