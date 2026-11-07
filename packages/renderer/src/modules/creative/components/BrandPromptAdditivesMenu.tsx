import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, Star, Bookmark } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTriggerButton,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/DropdownMenu';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { STUDIO_TAGS } from '../constants';
import { PromptAdditiveTracker, PromptAdditiveUsage } from '@/services/creative/PromptAdditiveTracker';
import { judgeCreativePromptAdditiveSuggestions } from '@/config/typesafeJudgments';

interface BrandPromptAdditivesMenuProps {
    onSelectAdditive: (tag: string, category?: string) => void;
    currentPrompt?: string;
    className?: string;
}

export const BrandPromptAdditivesMenu: React.FC<BrandPromptAdditivesMenuProps> = ({
    onSelectAdditive,
    currentPrompt = '',
    className = '',
}) => {
    const brandKit = useStore(useShallow((state) => state.userProfile?.brandKit));
    const [rankedAdditives, setRankedAdditives] = useState<PromptAdditiveUsage[]>([]);

    // Brand Kit tags extracted directly from user branding preferences
    const brandAdditives = useMemo(() => {
        const items: { label: string; tag: string; type: string }[] = [];

        if (brandKit?.brandDescription?.trim()) {
            items.push({
                label: `Brand Aesthetic: ${brandKit.brandDescription.slice(0, 32)}...`,
                tag: brandKit.brandDescription,
                type: 'Aesthetic',
            });
        }
        if (brandKit?.releaseDetails?.mood?.trim()) {
            items.push({
                label: `Mood: ${brandKit.releaseDetails.mood}`,
                tag: brandKit.releaseDetails.mood,
                type: 'Mood',
            });
        }
        if (brandKit?.releaseDetails?.themes?.trim()) {
            items.push({
                label: `Theme: ${brandKit.releaseDetails.themes}`,
                tag: brandKit.releaseDetails.themes,
                type: 'Theme',
            });
        }
        if (brandKit?.releaseDetails?.genre?.trim()) {
            items.push({
                label: `Genre: ${brandKit.releaseDetails.genre}`,
                tag: brandKit.releaseDetails.genre,
                type: 'Genre',
            });
        }
        if (Array.isArray(brandKit?.colors) && brandKit.colors.length > 0) {
            brandKit.colors.forEach((color) => {
                items.push({
                    label: `Palette: ${color}`,
                    tag: `Color palette: ${color}`,
                    type: 'Color',
                });
            });
        }
        if (brandKit?.fonts?.trim()) {
            items.push({
                label: `Typography: ${brandKit.fonts}`,
                tag: `Font style: ${brandKit.fonts}`,
                type: 'Font',
            });
        }

        return items;
    }, [brandKit]);

    // Most frequently used prompt additives recorded by the tracker
    const rawFrequentAdditives = useMemo(() => {
        return PromptAdditiveTracker.getFrequentAdditives(8);
    }, []);

    // Jev System One contextual additive ranking
    useEffect(() => {
        if (rawFrequentAdditives.length === 0) return;

        let isMounted = true;
        void judgeCreativePromptAdditiveSuggestions(currentPrompt, rawFrequentAdditives).then((results) => {
            if (isMounted && Array.isArray(results) && results.length > 0) {
                setRankedAdditives(results as PromptAdditiveUsage[]);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [currentPrompt, rawFrequentAdditives]);

    const frequentAdditives = (rawFrequentAdditives.length > 0 && rankedAdditives.length > 0)
        ? rankedAdditives
        : rawFrequentAdditives;

    const handleSelect = (tag: string, category?: string) => {
        PromptAdditiveTracker.recordUsage(tag, category);
        onSelectAdditive(tag, category);
    };

    // Group studio categories into primary descriptors
    const primaryCategories = useMemo(() => {
        return ['Environment', 'Material', 'Lighting', 'Camera', 'Style', 'Engine', 'Composition', 'Mood'];
    }, []);

    return (
        <DropdownMenu>
            <DropdownMenuTriggerButton
                data-testid="modifiers-trigger"
                className={`self-start text-[9.5px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 border-white/10 text-gray-200 flex items-center gap-1.5 py-1.5 px-3 rounded-xl transition-all shadow-sm ${className}`}
            >
                <Sparkles size={11} className="text-dept-creative" />
                <span>+ Brand & Prompt Additives</span>
            </DropdownMenuTriggerButton>
            <DropdownMenuContent className="w-64 max-h-[360px]">
                {/* Brand Identity / Preferences section */}
                <DropdownMenuLabel className="flex items-center gap-1.5 text-dept-creative">
                    <Bookmark size={11} /> Brand Identity
                </DropdownMenuLabel>
                {brandAdditives.length > 0 ? (
                    brandAdditives.map((item, index) => (
                        <DropdownMenuItem
                            key={`${item.type}-${index}`}
                            onSelect={(e) => {
                                e.preventDefault();
                                handleSelect(item.tag, item.type);
                            }}
                            className="text-xs flex items-center justify-between"
                        >
                            <span className="truncate pr-2">{item.label}</span>
                            <span className="text-[9px] font-mono text-gray-500 uppercase">{item.type}</span>
                        </DropdownMenuItem>
                    ))
                ) : (
                    <div className="px-3 py-1.5 text-[10px] text-gray-500 italic">
                        No brand kit preferences set yet
                    </div>
                )}

                <DropdownMenuSeparator />

                {/* Frequently Used Additives Submenu */}
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                        data-testid="frequent-additives-subtrigger"
                        className="text-xs text-amber-300/90 font-medium"
                    >
                        <span className="flex items-center gap-1.5">
                            <Star size={11} className="text-amber-400" />
                            <span>Frequently Used</span>
                        </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                        <DropdownMenuLabel className="text-amber-400">Top Additives</DropdownMenuLabel>
                        {frequentAdditives.length > 0 ? (
                            frequentAdditives.map((item) => (
                                <DropdownMenuItem
                                    key={item.tag}
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        handleSelect(item.tag, item.category);
                                    }}
                                    className="text-xs flex items-center justify-between"
                                >
                                    <span className="truncate pr-2">{item.tag}</span>
                                    <span className="text-[9px] font-mono text-gray-400 bg-white/5 px-1 rounded">
                                        {item.count}×
                                    </span>
                                </DropdownMenuItem>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-[10px] text-gray-500 italic">
                                Additives you use will appear here
                            </div>
                        )}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Studio Descriptors & Additive Categories */}
                <DropdownMenuLabel>Studio Additives</DropdownMenuLabel>
                {primaryCategories.map((catName) => {
                    const values = STUDIO_TAGS[catName];
                    if (!values) return null;

                    return (
                        <DropdownMenuSub key={catName}>
                            <DropdownMenuSubTrigger
                                data-testid={`category-sub-${catName}`}
                                className="text-xs"
                            >
                                <span>{catName}</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-60 max-h-[280px]">
                                <DropdownMenuLabel>{catName} Descriptors</DropdownMenuLabel>
                                {Array.isArray(values) ? (
                                    values.map((tag) => (
                                        <DropdownMenuItem
                                            key={tag}
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                handleSelect(tag, catName);
                                            }}
                                            className="text-xs"
                                        >
                                            + {tag}
                                        </DropdownMenuItem>
                                    ))
                                ) : (
                                    Object.entries(values).map(([subGroup, tags]) => (
                                        <div key={subGroup} className="mb-2">
                                            <div className="px-2 py-0.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                                {subGroup}
                                            </div>
                                            {tags.map((tag) => (
                                                <DropdownMenuItem
                                                    key={tag}
                                                    onSelect={(e) => {
                                                        e.preventDefault();
                                                        handleSelect(tag, catName);
                                                    }}
                                                    className="text-xs pl-3"
                                                >
                                                    + {tag}
                                                </DropdownMenuItem>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
