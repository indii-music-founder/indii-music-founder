import React, { useState } from 'react';
import { ChecklistHeader } from './ChecklistHeader';
import { ProRegistrationSection } from './ProRegistrationSection';
import { SoundExchangeSection } from './SoundExchangeSection';
import { MlcSection } from './MlcSection';
import { CopyrightSection } from './CopyrightSection';
import { ActionPanel } from './ActionPanel';
import { ReleaseGateBanner } from './ReleaseGateBanner';
import { RegistrationChecklistProps } from '../types';

export const RegistrationChecklist: React.FC<RegistrationChecklistProps> = ({
    profile,
    onProSelect,
    isReleaseGate = false
}) => {
    // Determine which section should be open initially
    // Default to PRO Registration if it's not complete, otherwise none
    const [expandedSection, setExpandedSection] = useState<'pro' | 'soundexchange' | 'mlc' | 'copyright' | null>(
        profile.proRegistration.status !== 'active' ? 'pro' : null
    );

    const toggleSection = (section: 'pro' | 'soundexchange' | 'mlc' | 'copyright') => {
        setExpandedSection(prev => prev === section ? null : section);
    };

    const scrollToSection = (sectionId: string) => {
        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="relative pb-32">
            <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Conditional Release Gate Banner */}
                {isReleaseGate && (
                    <ReleaseGateBanner
                        profile={profile}
                        scrollToSection={scrollToSection}
                    />
                )}

                {/* Header */}
                <ChecklistHeader profile={profile} />

                {/* Sections Container */}
                <div className="space-y-4">
                    <ProRegistrationSection
                        profile={profile}
                        isExpanded={expandedSection === 'pro'}
                        onToggle={() => toggleSection('pro')}
                        onSelectPro={onProSelect}
                    />

                    <SoundExchangeSection
                        profile={profile}
                        isExpanded={expandedSection === 'soundexchange'}
                        onToggle={() => toggleSection('soundexchange')}
                    />

                    <MlcSection
                        profile={profile}
                        isExpanded={expandedSection === 'mlc'}
                        onToggle={() => toggleSection('mlc')}
                        onGoToPro={() => {
                            toggleSection('pro');
                            scrollToSection('pro-registration');
                        }}
                    />

                    <CopyrightSection
                        profile={profile}
                        isExpanded={expandedSection === 'copyright'}
                        onToggle={() => toggleSection('copyright')}
                    />
                </div>
            </div>

            {/* Sticky Bottom Action Panel */}
            <ActionPanel
                profile={profile}
                onComplete={() => {
                    // Typically navigates to Dashboard
                    console.log("Registration complete! Routing to Dashboard...");
                }}
            />
        </div>
    );
};
