import { secureRandomAlphanumeric } from '@/utils/crypto-random';

interface VisaPlanningItem {
    id: string;
    label: string;
    required: boolean;
    checked: boolean;
}

export interface VisaPlanningEntry {
    id: string;
    country: string;
    visaType: string;
    processingDays: number | null;
    docs: VisaPlanningItem[];
}

const PLANNING_ITEMS = [
    'Confirm traveler nationality, residency, and passport validity',
    'Document every performance date, venue, and compensation arrangement',
    'Collect promoter and venue contact details',
    'Gather signed performance agreements and the complete itinerary',
    'Check the destination government immigration website for the current classification',
    'Have licensed immigration counsel or the official authority verify the filing requirements',
];

export function createVisaPlanningEntry(country: string, id = secureRandomAlphanumeric(7)): VisaPlanningEntry {
    return {
        id,
        country,
        visaType: 'Official immigration classification not verified',
        processingDays: null,
        docs: PLANNING_ITEMS.map(label => ({
            id: secureRandomAlphanumeric(7),
            label,
            required: false,
            checked: false,
        })),
    };
}

export function loadVisaPlanningEntries(): VisaPlanningEntry[] {
    try {
        const saved = localStorage.getItem('indii_visa_checklist_entries');
        if (!saved) return [createVisaPlanningEntry('Canada')];
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [createVisaPlanningEntry('Canada')];

        const countries = parsed
            .filter((entry): entry is { id?: unknown; country: string } => (
                typeof entry === 'object'
                && entry !== null
                && typeof (entry as { country?: unknown }).country === 'string'
                && (entry as { country: string }).country.trim().length > 0
            ))
            .map(entry => createVisaPlanningEntry(
                entry.country.trim().slice(0, 80),
                typeof entry.id === 'string' && entry.id ? entry.id : secureRandomAlphanumeric(7),
            ));

        return countries.length > 0 ? countries : [createVisaPlanningEntry('Canada')];
    } catch {
        return [createVisaPlanningEntry('Canada')];
    }
}
