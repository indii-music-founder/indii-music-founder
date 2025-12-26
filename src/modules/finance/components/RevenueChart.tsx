import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartDataPoint {
    label: string;
    value: number;
}

interface RevenueChartProps {
    data: ChartDataPoint[];
    title?: string;
    valuePrefix?: string;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
    data,
    title = "Revenue Over Time",
    valuePrefix = "$"
}) => {
    const maxValue = Math.max(...data.map(d => d.value));

    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="flex h-[200px] w-full items-end justify-between space-x-2 p-4">
                    {data.map((point, index) => (
                        <div key={index} className="flex flex-col items-center justify-end h-full w-full group">
                            <div className="relative w-full flex items-end h-[90%] rounded-md bg-muted overflow-hidden">
                                <div
                                    className="w-full bg-primary transition-all duration-500 ease-in-out group-hover:bg-primary/80"
                                    style={{ height: `${(point.value / maxValue) * 100}%` }}
                                />
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow">
                                    {valuePrefix}{point.value.toLocaleString()}
                                </div>
                            </div>
                            <span className="text-xs text-muted-foreground mt-2 truncate w-full text-center">
                                {point.label}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
