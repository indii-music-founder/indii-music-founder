import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ReleaseEarnings } from '@/services/ddex/types/dsr';

interface EarningsTableProps {
    data: ReleaseEarnings[];
}

export const EarningsTable: React.FC<EarningsTableProps> = ({ data }) => {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Release</TableHead>
                        <TableHead>ISRC</TableHead>
                        <TableHead className="text-right">Streams</TableHead>
                        <TableHead className="text-right">Downloads</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row) => (
                        <TableRow key={row.releaseId}>
                            <TableCell className="font-medium">{row.releaseName}</TableCell>
                            <TableCell>{row.isrc || '-'}</TableCell>
                            <TableCell className="text-right">{row.streams.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{row.downloads.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${row.revenue.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
