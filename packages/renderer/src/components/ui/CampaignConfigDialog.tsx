import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { Button } from './button';
import { useState } from 'react';

export interface CampaignLaunchConfig {
    dailyBudget: number;
    totalDays: number;
    targetAgeMin: number;
    targetAgeMax: number;
    targetInterests: string[];
    headline: string;
    body: string;
}

interface CampaignConfigProps {
    variantCount: number;
    defaultHeadline?: string;
    defaultBody?: string;
}

const fieldClass = "w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-dept-creative";
const labelClass = "block text-sm text-gray-400 mb-1";

export const CampaignConfigDialog = createCallable<CampaignConfigProps, CampaignLaunchConfig | null>(({
    call,
    variantCount,
    defaultHeadline = '',
    defaultBody = '',
}) => {
    const [dailyBudget, setDailyBudget] = useState('10.00');
    const [totalDays, setTotalDays] = useState('28');
    const [ageMin, setAgeMin] = useState('18');
    const [ageMax, setAgeMax] = useState('35');
    const [interests, setInterests] = useState('music, creativity, art');
    const [headline, setHeadline] = useState(defaultHeadline);
    const [body, setBody] = useState(defaultBody);

    const budget = parseFloat(dailyBudget);
    const days = parseInt(totalDays, 10);
    const min = parseInt(ageMin, 10);
    const max = parseInt(ageMax, 10);
    const parsedInterests = interests.split(',').map(s => s.trim()).filter(Boolean);

    const budgetValid = Number.isFinite(budget) && budget >= 1;
    const daysValid = Number.isInteger(days) && days >= 1 && days <= 365;
    const agesValid = Number.isInteger(min) && Number.isInteger(max) && min >= 13 && max <= 65 && min <= max;
    const copyValid = headline.trim().length > 0 && body.trim().length > 0;
    const isValid = budgetValid && daysValid && agesValid && copyValid && parsedInterests.length > 0;

    const estTotal = budgetValid && daysValid ? (budget * days).toFixed(2) : '—';

    return (
        <Modal isOpen={true} onClose={() => call.end(null)} titleId="campaign-config-title" maxWidth="max-w-lg">
            <div className="p-6">
                <h2 id="campaign-config-title" className="text-xl font-bold text-white mb-2">Launch a real paid ad campaign?</h2>
                <p className="text-gray-300 mb-4">
                    This deploys {variantCount} creatives to a live Meta ad campaign and <span className="text-amber-400 font-semibold">spends real money</span>.
                    Your variants are already saved either way. Review and edit everything below before launching.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label htmlFor="cc-daily-budget" className={labelClass}>Daily budget (USD)</label>
                        <input id="cc-daily-budget" type="number" min="1" step="0.50" value={dailyBudget}
                            onChange={(e) => setDailyBudget(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                        <label htmlFor="cc-total-days" className={labelClass}>Duration (days)</label>
                        <input id="cc-total-days" type="number" min="1" max="365" value={totalDays}
                            onChange={(e) => setTotalDays(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                        <label htmlFor="cc-age-min" className={labelClass}>Age min</label>
                        <input id="cc-age-min" type="number" min="13" max="65" value={ageMin}
                            onChange={(e) => setAgeMin(e.target.value)} className={fieldClass} />
                    </div>
                    <div>
                        <label htmlFor="cc-age-max" className={labelClass}>Age max</label>
                        <input id="cc-age-max" type="number" min="13" max="65" value={ageMax}
                            onChange={(e) => setAgeMax(e.target.value)} className={fieldClass} />
                    </div>
                </div>

                <div className="mb-3">
                    <label htmlFor="cc-interests" className={labelClass}>Target interests (comma-separated)</label>
                    <input id="cc-interests" type="text" value={interests}
                        onChange={(e) => setInterests(e.target.value)} className={fieldClass} />
                </div>

                <div className="mb-3">
                    <label htmlFor="cc-headline" className={labelClass}>Ad headline (applied to all {variantCount} variants)</label>
                    <input id="cc-headline" type="text" value={headline} placeholder="e.g. New single out now"
                        onChange={(e) => setHeadline(e.target.value)} className={fieldClass} />
                </div>

                <div className="mb-4">
                    <label htmlFor="cc-body" className={labelClass}>Ad body text</label>
                    <textarea id="cc-body" rows={3} value={body} placeholder="What should the ad say?"
                        onChange={(e) => setBody(e.target.value)} className={fieldClass} />
                </div>

                <p className="text-sm text-gray-400 mb-6">
                    Estimated total spend: <span className="text-white font-semibold">${estTotal}</span>
                    {budgetValid && daysValid && <> (${budget.toFixed(2)}/day × {days} days)</>}
                </p>

                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => call.end(null)}>
                        No, just keep the variants
                    </Button>
                    <Button variant="default" disabled={!isValid} onClick={() => call.end({
                        dailyBudget: budget,
                        totalDays: days,
                        targetAgeMin: min,
                        targetAgeMax: max,
                        targetInterests: parsedInterests,
                        headline: headline.trim(),
                        body: body.trim(),
                    })}>
                        Launch campaign — ${estTotal}
                    </Button>
                </div>
            </div>
        </Modal>
    );
});
