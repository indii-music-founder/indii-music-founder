import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Globe, DollarSign, ChevronDown, RefreshCw } from 'lucide-react';

/* ================================================================== */
/*  Item 153 — Multi-Currency Ledger                                   */
/* ================================================================== */

interface LedgerRow {
    id: number;
    description: string;
    amount: number;
    currency: 'USD' | 'GBP' | 'EUR' | 'JPY' | 'CAD';
    exchangeRate: number;
    usdEquivalent: number;
    date: string;
}

const EXCHANGE_RATES: Record<string, number> = {
    USD: 1.0,
    GBP: 1.268,
    EUR: 1.084,
    JPY: 0.00671,
    CAD: 0.737,
};

const LEDGER_DATA: LedgerRow[] = [];

const CURRENCY_FLAGS: Record<string, string> = {
    USD: '🇺🇸',
    GBP: '🇬🇧',
    EUR: '🇪🇺',
    JPY: '🇯🇵',
    CAD: '🇨🇦',
};

const CURRENCY_COLORS: Record<string, string> = {
    USD: 'text-green-400 bg-green-500/10',
    GBP: 'text-blue-400 bg-blue-500/10',
    EUR: 'text-yellow-400 bg-yellow-500/10',
    JPY: 'text-red-400 bg-red-500/10',
    CAD: 'text-orange-400 bg-orange-500/10',
};

export function MultiCurrencyLedger() {
    const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
    const [convertAll, setConvertAll] = useState(false);
    const lastUpdated = '2026-03-07 09:42 UTC';

    const filteredData = useMemo(() => {
        if (currencyFilter === 'ALL') return LEDGER_DATA;
        return LEDGER_DATA.filter((r) => r.currency === currencyFilter);
    }, [currencyFilter]);

    const totalUSD = useMemo(
        () => filteredData.reduce((sum, r) => sum + r.usdEquivalent, 0),
        [filteredData]
    );

    function formatAmount(row: LedgerRow) {
        if (convertAll) {
            return `$${row.usdEquivalent.toFixed(2)} USD`;
        }
        if (row.currency === 'JPY') {
            return `¥${row.amount.toLocaleString()} JPY`;
        }
        const symbols: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$' };
        return `${symbols[row.currency] || ''}${row.amount.toFixed(2)} ${row.currency}`;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Globe size={14} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Multi-Currency Ledger</h2>
                        <p className="text-[10px] text-gray-500">Exchange rates as of {lastUpdated}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <RefreshCw size={10} className="text-gray-600" />
                    <span className="text-[10px] text-gray-500">{lastUpdated}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
                {/* Currency Filter */}
                <div className="relative">
                    <select
                        value={currencyFilter}
                        onChange={(e) => setCurrencyFilter(e.target.value)}
                        className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                        <option value="ALL">All Currencies</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                        <option value="JPY">JPY</option>
                        <option value="CAD">CAD</option>
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>

                {/* Convert All Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <div
                        onClick={() => setConvertAll((v) => !v)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${convertAll ? 'bg-blue-500' : 'bg-white/10'}`}
                    >
                        <motion.div
                            animate={{ x: convertAll ? 16 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow"
                        />
                    </div>
                    <span className="text-xs text-gray-400">Convert All to USD</span>
                </label>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Description</th>
                            <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">Amount</th>
                            <th className="text-center px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Currency</th>
                            <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Rate</th>
                            <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide">USD Equiv.</th>
                            <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-8 text-center border-b border-white/[0.03]">
                                    <div className="flex flex-col items-center justify-center">
                                        <Globe size={18} className="text-gray-600 mb-2 opacity-50" />
                                        <p className="text-xs text-gray-500 font-medium">No international transactions found</p>
                                        <p className="text-[10px] text-gray-600 mt-0.5">Connect your distributor to import global royalty data</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((row, i) => (
                                <motion.tr
                                    key={row.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                                >
                                    <td className="px-3 py-2.5 text-gray-300">{row.description}</td>
                                    <td className="px-3 py-2.5 text-right font-mono text-white">{formatAmount(row)}</td>
                                    <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${CURRENCY_COLORS[row.currency]}`}>
                                            {CURRENCY_FLAGS[row.currency]} {row.currency}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-gray-500 hidden md:table-cell">
                                        {row.currency === 'JPY'
                                            ? row.exchangeRate.toFixed(5)
                                            : row.exchangeRate.toFixed(3)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-green-400 font-bold">
                                        ${row.usdEquivalent.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-gray-500 hidden sm:table-cell">{row.date}</td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-white/[0.03] border-t border-white/10">
                            <td colSpan={4} className="px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">
                                Total ({filteredData.length} entries)
                            </td>
                            <td className="px-3 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                    <DollarSign size={12} className="text-green-400" />
                                    <span className="text-sm font-black text-white">{totalUSD.toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-500">USD</span>
                                </div>
                            </td>
                            <td className="hidden sm:table-cell" />
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Exchange Rate Reference */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(EXCHANGE_RATES).filter(([k]) => k !== 'USD').map(([currency, rate]) => (
                    <div key={currency} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/5">
                        <span className="text-[10px] text-gray-500">{CURRENCY_FLAGS[currency]} {currency}</span>
                        <span className="text-[10px] text-gray-400">=</span>
                        <span className="text-[10px] font-bold text-white">${rate} USD</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
