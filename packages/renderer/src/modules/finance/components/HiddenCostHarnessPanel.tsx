import React, { useMemo } from 'react';
import { Car, Clock, DollarSign, Guitar, PieChart, Shield } from 'lucide-react';
import type { Expense } from '../schemas';
import { hiddenCostHarnessService } from '@/services/business-harness';

export function HiddenCostHarnessPanel({ expenses }: { expenses: Expense[] }) {
  const costLines = useMemo(() => {
    const expenseLines = expenses.slice(0, 20).map(expense => hiddenCostHarnessService.buildExpenseCostLine(expense));
    const userId = expenses[0]?.userId;
    const scenario = userId
      ? hiddenCostHarnessService.buildGuitarStoreScenario({
        userId,
        equipmentCost: 14.99,
        milesRoundTrip: 18,
        driveMinutes: 42,
        hourlyRate: 50,
        mileageRate: 0.7,
      })
      : [];
    return [...expenseLines, ...scenario];
  }, [expenses]);
  const summary = useMemo(() => hiddenCostHarnessService.summarizeCostLines(costLines), [costLines]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Metric icon={<DollarSign size={16} />} label="Cash" value={summary.byType.cash_expense} />
        <Metric icon={<Clock size={16} />} label="Time Value" value={summary.byType.time_value} />
        <Metric icon={<Car size={16} />} label="Mileage" value={summary.byType.mileage} />
      </div>

      <section className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Guitar size={16} className="text-amber-300" />
          <h3 className="text-sm font-bold text-white">Supply Run Example</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {costLines.slice(-3).map(line => (
            <div key={line.id} className="rounded-lg bg-black/20 border border-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{line.costType.replaceAll('_', ' ')}</p>
              <p className="text-lg font-black text-white">${line.amount.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-2">{line.notes}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={16} className="text-emerald-300" />
          <h3 className="text-sm font-bold text-white">Harness Cost Lines</h3>
        </div>
        <div className="space-y-2">
          {costLines.slice(0, 8).map(line => (
            <div key={line.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center rounded-lg bg-white/[0.02] px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{line.category}</p>
                <p className="text-[10px] text-gray-500 truncate">{line.notes}</p>
              </div>
              <span className="text-[10px] text-gray-400 capitalize">{line.costType.replaceAll('_', ' ')}</span>
              <span className="text-xs font-bold text-white">${line.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-3 flex items-start gap-2 text-xs text-blue-200/80">
        <Shield size={14} className="mt-0.5 shrink-0" />
        <span>Time value and mileage are business investment records. They are kept separate from revenue and should be reviewed against current tax rules before filing.</span>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-black text-white">${value.toFixed(2)}</p>
    </div>
  );
}
