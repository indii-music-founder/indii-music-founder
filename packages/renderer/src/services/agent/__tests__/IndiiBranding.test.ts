import { describe, it, expect } from 'vitest';
import { AGENT_SYSTEM_BRANDING, INDII_MESSAGES } from '../constants';

describe('indii Branding Constants', () => {
    describe('AGENT_SYSTEM_BRANDING', () => {
        it('defines indii as the system name', () => {
            expect(AGENT_SYSTEM_BRANDING.name).toBe('indii');
        });

        it('uses lowercase for system name', () => {
            expect(AGENT_SYSTEM_BRANDING.name).toBe(AGENT_SYSTEM_BRANDING.name.toLowerCase());
        });

        it('provides full name with AI Agent System', () => {
            expect(AGENT_SYSTEM_BRANDING.fullName).toContain('indii');
            expect(AGENT_SYSTEM_BRANDING.fullName).toContain('AI Agent System');
        });

        it('identifies hub as indii', () => {
            expect(AGENT_SYSTEM_BRANDING.hubName).toBe('indii');
        });

        it('includes descriptive tagline for independent artists', () => {
            expect(AGENT_SYSTEM_BRANDING.description).toContain('independent artists');
            expect(AGENT_SYSTEM_BRANDING.description).toContain('AI');
        });

        it('has version number', () => {
            expect(AGENT_SYSTEM_BRANDING.version).toMatch(/^\d+\.\d+\.\d+$/);
        });

        it('is immutable (readonly)', () => {
            // TypeScript enforces this at compile time, but we can test the object is frozen
            expect(Object.isFrozen(AGENT_SYSTEM_BRANDING)).toBe(true);
        });
    });

    describe('INDII_MESSAGES', () => {
        it('provides welcome message with indii branding', () => {
            expect(INDII_MESSAGES.welcome).toContain('indii');
            expect(INDII_MESSAGES.welcome).toContain('indiiOS');
        });

        it('provides orchestrating message', () => {
            expect(INDII_MESSAGES.orchestrating).toContain('indii');
            expect(INDII_MESSAGES.orchestrating).toContain('specialists');
        });

        it('provides error message prefix', () => {
            expect(INDII_MESSAGES.error).toContain('indii');
        });

        it('provides loop detection message', () => {
            expect(INDII_MESSAGES.loopDetected).toContain('indii');
            expect(INDII_MESSAGES.loopDetected).toContain('loop');
        });

        it('is immutable (readonly)', () => {
            expect(Object.isFrozen(INDII_MESSAGES)).toBe(true);
        });
    });

    describe('INDII_MESSAGES - Dynamic Functions', () => {
        describe('hubSpokeViolation()', () => {
            it('generates violation message with source and target agents', () => {
                const message = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');
                expect(message).toContain('marketing');
                expect(message).toContain('legal');
            });

            it('includes indii architecture branding', () => {
                const message = INDII_MESSAGES.hubSpokeViolation('video', 'finance');
                expect(message).toContain('indii architecture rule');
            });

            it('references indii Conductor', () => {
                const message = INDII_MESSAGES.hubSpokeViolation('brand', 'social');
                expect(message).toContain('indii Conductor');
            });

            it('references generalist hub agent', () => {
                const message = INDII_MESSAGES.hubSpokeViolation('publicist', 'marketing');
                expect(message).toContain('generalist');
            });

            it('instructs proper delegation behavior', () => {
                const message = INDII_MESSAGES.hubSpokeViolation('legal', 'finance');
                expect(message).toContain('delegate');
                expect(message).toContain('coordinate');
            });

            it('handles different agent combinations consistently', () => {
                const msg1 = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');
                const msg2 = INDII_MESSAGES.hubSpokeViolation('video', 'brand');

                // Both should follow same structure
                expect(msg1).toContain('indii architecture rule');
                expect(msg2).toContain('indii architecture rule');
                expect(msg1).toContain('indii Conductor');
                expect(msg2).toContain('indii Conductor');
            });

            it('produces unique messages for different agent pairs', () => {
                const msg1 = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');
                const msg2 = INDII_MESSAGES.hubSpokeViolation('video', 'brand');

                expect(msg1).not.toBe(msg2);
                expect(msg1).toContain('marketing');
                expect(msg1).toContain('legal');
                expect(msg2).toContain('video');
                expect(msg2).toContain('brand');
            });
        });

        describe('routingToAgent()', () => {
            it('generates routing message with agent name', () => {
                const message = INDII_MESSAGES.routingToAgent('Marketing Agent');
                expect(message).toContain('Marketing Agent');
            });

            it('includes indii branding in routing message', () => {
                const message = INDII_MESSAGES.routingToAgent('Legal Agent');
                expect(message).toContain('indii');
            });

            it('indicates routing action', () => {
                const message = INDII_MESSAGES.routingToAgent('Finance Agent');
                expect(message).toContain('routing');
            });

            it('handles various agent names', () => {
                const agents = ['Marketing Agent', 'Legal Agent', 'Video Agent', 'Brand Agent'];

                agents.forEach(agentName => {
                    const message = INDII_MESSAGES.routingToAgent(agentName);
                    expect(message).toContain(agentName);
                    expect(message).toContain('indii');
                });
            });

            it('produces unique messages for different agents', () => {
                const msg1 = INDII_MESSAGES.routingToAgent('Marketing Agent');
                const msg2 = INDII_MESSAGES.routingToAgent('Legal Agent');

                expect(msg1).not.toBe(msg2);
            });
        });
    });

    describe('Message Consistency', () => {
        it('all messages use lowercase "indii" branding', () => {
            const messages = [
                INDII_MESSAGES.welcome,
                INDII_MESSAGES.orchestrating,
                INDII_MESSAGES.error,
                INDII_MESSAGES.loopDetected,
                INDII_MESSAGES.hubSpokeViolation('marketing', 'legal'),
                INDII_MESSAGES.routingToAgent('Test Agent')
            ];

            messages.forEach(message => {
                // Should contain "indii" but not "Indii" or "INDII" (except at start of sentence)
                const indiiMatches = message.match(/\bindii\b/gi) || [];
                indiiMatches.forEach(match => {
                    // Allow capitalization only at sentence start
                    const isAtSentenceStart = message.indexOf(match) === 0;
                    if (!isAtSentenceStart) {
                        expect(match).toBe('indii');
                    }
                });
            });
        });

        it('all messages are user-friendly and clear', () => {
            const messages = [
                INDII_MESSAGES.welcome,
                INDII_MESSAGES.orchestrating,
                INDII_MESSAGES.error,
                INDII_MESSAGES.loopDetected,
                INDII_MESSAGES.hubSpokeViolation('marketing', 'legal')
            ];

            messages.forEach(message => {
                // Should be non-empty and not overly technical
                expect(message.length).toBeGreaterThan(10);
                expect(message).not.toContain('Error:');
                expect(message).not.toContain('Exception');
            });
        });

        it('error messages provide actionable guidance', () => {
            const violationMsg = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');

            // Should explain what went wrong and what to do instead
            expect(violationMsg).toContain('cannot');
            expect(violationMsg).toContain('must');
            expect(violationMsg).toContain('generalist');
        });
    });

    describe('Branding Guidelines Compliance', () => {
        it('uses "indii" not "Indii" in code constants', () => {
            expect(AGENT_SYSTEM_BRANDING.name).toBe('indii');
        });

        it('uses "indii" for hub branding', () => {
            expect(AGENT_SYSTEM_BRANDING.hubName).toBe('indii');

            const violationMsg = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');
            // The violation message should contain indii architecture reference
            expect(violationMsg).toContain('indii');
        });

        it('maintains consistent "indii AI Agent System" nomenclature', () => {
            expect(AGENT_SYSTEM_BRANDING.fullName).toBe('indii AI Agent System');
        });

        it('associates indii with independent artists', () => {
            expect(AGENT_SYSTEM_BRANDING.description).toContain('independent artists');
        });

        it('emphasizes AI-powered nature', () => {
            expect(AGENT_SYSTEM_BRANDING.description).toContain('AI');
            expect(AGENT_SYSTEM_BRANDING.fullName).toContain('AI');
        });
    });

    describe('Integration Points', () => {
        it('branding constants are importable from single source', () => {
            // Both AGENT_SYSTEM_BRANDING and INDII_MESSAGES should be from same module
            expect(AGENT_SYSTEM_BRANDING).toBeDefined();
            expect(INDII_MESSAGES).toBeDefined();
        });

        it('messages are suitable for display to users', () => {
            // Welcome message should be friendly
            expect(INDII_MESSAGES.welcome).toContain('Welcome');

            // Error message should be informative
            expect(INDII_MESSAGES.error).toContain('issue');

            // Orchestrating message should indicate action
            expect(INDII_MESSAGES.orchestrating).toContain('coordinating');
        });

        it('branding version follows semantic versioning', () => {
            const version = AGENT_SYSTEM_BRANDING.version;
            const parts = version.split('.');

            expect(parts).toHaveLength(3);
            expect(parseInt(parts[0]!)).toBeGreaterThanOrEqual(0);
            expect(parseInt(parts[1]!)).toBeGreaterThanOrEqual(0);
            expect(parseInt(parts[2]!)).toBeGreaterThanOrEqual(0);
        });
    });
});
