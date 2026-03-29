import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateHubAndSpoke, HUB_AGENT_ID, VALID_AGENT_IDS } from '../types';
import { INDII_MESSAGES } from '../constants';

describe('Agent Delegation and Collaboration', () => {
    describe('Delegation Validation', () => {
        it('validates delegation before executing', () => {
            // This ensures hub-spoke rules are checked before any delegation occurs
            const validDelegation = validateHubAndSpoke('generalist', 'marketing');
            expect(validDelegation).toBeNull();

            const invalidDelegation = validateHubAndSpoke('marketing', 'legal');
            expect(invalidDelegation).not.toBeNull();
        });

        it('provides clear error for invalid delegation attempts', () => {
            const error = validateHubAndSpoke('video', 'finance');

            expect(error).toBeTruthy();
            expect(error).toContain('indii architecture rule');
            expect(error).toContain('video');
            expect(error).toContain('finance');
        });

        it('allows hub to coordinate multi-agent workflows', () => {
            // Hub should be able to delegate to multiple specialists in sequence
            const agents = ['marketing', 'brand', 'social'];

            agents.forEach(agent => {
                const result = validateHubAndSpoke(HUB_AGENT_ID, agent);
                expect(result).toBeNull();
            });
        });

        it('enforces specialists return control to hub', () => {
            const specialists = ['marketing', 'legal', 'finance'];

            specialists.forEach(specialist => {
                // Specialist can delegate back to hub
                const toHub = validateHubAndSpoke(specialist, HUB_AGENT_ID);
                expect(toHub).toBeNull();

                // But cannot delegate to other specialists
                specialists.forEach(otherSpecialist => {
                    if (specialist !== otherSpecialist) {
                        const toOther = validateHubAndSpoke(specialist, otherSpecialist);
                        expect(toOther).not.toBeNull();
                    }
                });
            });
        });
    });

    describe('Collaboration Workflows', () => {
        it('workflow: marketing campaign requiring multiple specialists', () => {
            // User request: "Create a marketing campaign for my album release"
            // Expected flow: Hub -> Marketing -> Hub -> Brand -> Hub -> Social

            const flow = [
                { from: 'generalist', to: 'marketing', task: 'Plan campaign strategy' },
                { from: 'marketing', to: 'generalist', task: 'Report campaign plan' },
                { from: 'generalist', to: 'brand', task: 'Get brand guidelines' },
                { from: 'brand', to: 'generalist', task: 'Provide brand assets' },
                { from: 'generalist', to: 'social', task: 'Schedule social posts' },
                { from: 'social', to: 'generalist', task: 'Confirm schedule' }
            ];

            flow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                expect(validation).toBeNull();
            });
        });

        it('workflow: video production requiring coordination', () => {
            // User request: "Create a music video from script to final cut"
            // Flow: Hub -> Video -> Hub -> Brand (for visuals) -> Hub -> Video

            const flow = [
                { from: 'generalist', to: 'video', task: 'Create initial storyboard' },
                { from: 'video', to: 'generalist', task: 'Submit storyboard' },
                { from: 'generalist', to: 'brand', task: 'Verify brand alignment' },
                { from: 'brand', to: 'generalist', task: 'Approve with notes' },
                { from: 'generalist', to: 'video', task: 'Refine with brand notes' }
            ];

            flow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                expect(validation).toBeNull();
            });
        });

        it('workflow: contract review with legal and finance', () => {
            // User request: "Review this distribution deal"
            // Flow: Hub -> Legal -> Hub -> Finance -> Hub

            const flow = [
                { from: 'generalist', to: 'legal', task: 'Review contract terms' },
                { from: 'legal', to: 'generalist', task: 'Report legal assessment' },
                { from: 'generalist', to: 'finance', task: 'Analyze financial terms' },
                { from: 'finance', to: 'generalist', task: 'Provide financial analysis' }
            ];

            flow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                expect(validation).toBeNull();
            });
        });

        it('blocked workflow: specialist bypassing hub', () => {
            // Invalid flow: Marketing trying to directly coordinate with Brand
            const invalidFlow = [
                { from: 'generalist', to: 'marketing', valid: true },
                { from: 'marketing', to: 'brand', valid: false }, // ❌ Violation
                { from: 'brand', to: 'marketing', valid: false }  // ❌ Violation
            ];

            invalidFlow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                if (step.valid) {
                    expect(validation).toBeNull();
                } else {
                    expect(validation).not.toBeNull();
                    expect(validation).toContain('indii architecture rule');
                }
            });
        });
    });

    describe('Error Handling and Recovery', () => {
        it('provides actionable error when specialist tries invalid delegation', () => {
            const error = validateHubAndSpoke('marketing', 'legal');

            // Error should tell them what they did wrong
            expect(error).toContain('marketing');
            expect(error).toContain('legal');
            expect(error).toContain('cannot');

            // Error should tell them what to do instead
            expect(error).toContain('generalist');
            expect(error).toContain('indii Conductor');
        });

        it('maintains hub-spoke integrity even with circular requests', () => {
            // Even if the flow circles back, hub-spoke rules must be enforced
            const circularFlow = [
                { from: 'generalist', to: 'marketing' },
                { from: 'marketing', to: 'generalist' },
                { from: 'generalist', to: 'brand' },
                { from: 'brand', to: 'generalist' },
                { from: 'generalist', to: 'marketing' } // Back to marketing
            ];

            circularFlow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                expect(validation).toBeNull();
            });
        });

        it('prevents specialist-to-specialist shortcuts in complex workflows', () => {
            // Complex workflow where specialists might try to shortcut
            const specialists = ['marketing', 'brand', 'social', 'publicist'];

            // None of these should be able to talk directly
            specialists.forEach(source => {
                specialists.forEach(target => {
                    if (source !== target) {
                        const validation = validateHubAndSpoke(source, target);
                        expect(validation).not.toBeNull();
                    }
                });
            });
        });
    });

    describe('Hub Capabilities', () => {
        it('hub can delegate to any specialist without restriction', () => {
            const allAgents = VALID_AGENT_IDS.filter(id => id !== HUB_AGENT_ID);

            allAgents.forEach(agentId => {
                const validation = validateHubAndSpoke(HUB_AGENT_ID, agentId);
                expect(validation).toBeNull();
            });
        });

        it('hub can receive delegation from any specialist', () => {
            const specialists = VALID_AGENT_IDS.filter(id => id !== HUB_AGENT_ID);

            specialists.forEach(specialist => {
                const validation = validateHubAndSpoke(specialist, HUB_AGENT_ID);
                expect(validation).toBeNull();
            });
        });

        it('hub can self-delegate (for complex reasoning)', () => {
            const validation = validateHubAndSpoke(HUB_AGENT_ID, HUB_AGENT_ID);
            expect(validation).toBeNull();
        });
    });

    describe('Specialist Constraints', () => {
        it('specialist can only delegate to hub, never to other specialists', () => {
            const testSpecialist = 'marketing';
            const otherSpecialists = ['legal', 'finance', 'video', 'brand'];

            // Can delegate to hub
            expect(validateHubAndSpoke(testSpecialist, HUB_AGENT_ID)).toBeNull();

            // Cannot delegate to any other specialist
            otherSpecialists.forEach(other => {
                const validation = validateHubAndSpoke(testSpecialist, other);
                expect(validation).not.toBeNull();
            });
        });

        it('specialist cannot self-delegate', () => {
            const specialists = ['marketing', 'legal', 'finance', 'video'];

            specialists.forEach(specialist => {
                const validation = validateHubAndSpoke(specialist, specialist);
                expect(validation).not.toBeNull();
                expect(validation).toContain('indii architecture rule');
            });
        });
    });

    describe('Real-World Scenario Tests', () => {
        it('scenario: album release campaign', () => {
            // Complete flow for album release
            const albumReleaseFlow = [
                // 1. User asks hub about album release
                { from: 'generalist', to: 'marketing', desc: 'Create release strategy' },

                // 2. Marketing returns to hub with strategy
                { from: 'marketing', to: 'generalist', desc: 'Strategy complete' },

                // 3. Hub delegates to brand for visuals
                { from: 'generalist', to: 'brand', desc: 'Create album artwork' },

                // 4. Brand returns to hub
                { from: 'brand', to: 'generalist', desc: 'Artwork ready' },

                // 5. Hub delegates to social for scheduling
                { from: 'generalist', to: 'social', desc: 'Schedule posts' },

                // 6. Social returns to hub
                { from: 'social', to: 'generalist', desc: 'Posts scheduled' },

                // 7. Hub delegates to distribution for release
                { from: 'generalist', to: 'distribution', desc: 'Upload to DSPs' },

                // 8. Distribution returns to hub
                { from: 'distribution', to: 'generalist', desc: 'Release confirmed' }
            ];

            albumReleaseFlow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                expect(validation).toBeNull();
            });
        });

        it('scenario: legal contract with financial analysis', () => {
            const contractFlow = [
                { from: 'generalist', to: 'legal', desc: 'Review contract' },
                { from: 'legal', to: 'generalist', desc: 'Legal review complete' },
                { from: 'generalist', to: 'finance', desc: 'Analyze deal terms' },
                { from: 'finance', to: 'generalist', desc: 'Financial analysis complete' }
            ];

            contractFlow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                expect(validation).toBeNull();
            });
        });

        it('scenario: music video production pipeline', () => {
            const videoFlow = [
                { from: 'generalist', to: 'video', desc: 'Create storyboard' },
                { from: 'video', to: 'generalist', desc: 'Storyboard draft' },
                { from: 'generalist', to: 'brand', desc: 'Verify brand alignment' },
                { from: 'brand', to: 'generalist', desc: 'Brand approval' },
                { from: 'generalist', to: 'video', desc: 'Proceed with production' },
                { from: 'video', to: 'generalist', desc: 'Video complete' },
                { from: 'generalist', to: 'marketing', desc: 'Create promo plan' },
                { from: 'marketing', to: 'generalist', desc: 'Promo ready' }
            ];

            videoFlow.forEach(step => {
                const validation = validateHubAndSpoke(step.from, step.to);
                expect(validation).toBeNull();
            });
        });
    });

    describe('Message Quality', () => {
        it('violation messages are developer-friendly', () => {
            const error = validateHubAndSpoke('marketing', 'legal');

            // Should be clear enough for developers debugging
            expect(error).toContain('indii architecture rule');
            expect(error).toContain('marketing');
            expect(error).toContain('legal');
        });

        it('violation messages are user-friendly (if exposed)', () => {
            const error = validateHubAndSpoke('video', 'brand');

            // Should be understandable if shown to users
            expect(error).not.toContain('Error:');
            expect(error).not.toContain('Exception');
            expect(error).not.toMatch(/[A-Z_]+\./); // No technical constant names
        });

        it('violation messages provide guidance', () => {
            const error = validateHubAndSpoke('social', 'publicist');

            // Should explain what to do instead
            expect(error).toContain('must delegate to');
            expect(error).toContain('generalist');
        });
    });

    describe('Edge Cases and Safety', () => {
        it('handles empty agent IDs gracefully', () => {
            const result = validateHubAndSpoke('', 'marketing');
            expect(result).not.toBeNull();
        });

        it('handles null/undefined agent IDs', () => {
            const result1 = validateHubAndSpoke(null as unknown as string, 'marketing');
            expect(result1).not.toBeNull();

            const result2 = validateHubAndSpoke('marketing', undefined as unknown as string);
            expect(result2).not.toBeNull();
        });

        it('handles malformed agent IDs', () => {
            const result = validateHubAndSpoke('marketing-invalid-id', 'legal');
            expect(result).not.toBeNull();
        });

        it('prevents injection attempts in agent IDs', () => {
            const maliciousIds = [
                'marketing"; DROP TABLE agents;--',
                '<script>alert("xss")</script>',
                '../../etc/passwd',
                'marketing\ninjection'
            ];

            maliciousIds.forEach(maliciousId => {
                const result = validateHubAndSpoke(maliciousId, 'legal');
                expect(result).not.toBeNull();
            });
        });
    });

    describe('Performance and Scalability', () => {
        it('validates hub-spoke rules in constant time', () => {
            const iterations = 1000;
            const start = Date.now();

            for (let i = 0; i < iterations; i++) {
                validateHubAndSpoke('generalist', 'marketing');
                validateHubAndSpoke('marketing', 'legal');
            }

            const duration = Date.now() - start;

            // Should be very fast (< 100ms for 1000 validations)
            expect(duration).toBeLessThan(100);
        });

        it('handles validation for all agent combinations efficiently', () => {
            const agents = VALID_AGENT_IDS;
            const combinations = agents.length * agents.length;

            const start = Date.now();

            agents.forEach(source => {
                agents.forEach(target => {
                    validateHubAndSpoke(source, target);
                });
            });

            const duration = Date.now() - start;

            // Should validate all combinations quickly
            expect(duration).toBeLessThan(50);
        });
    });
});
