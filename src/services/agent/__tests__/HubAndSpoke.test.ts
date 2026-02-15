import { describe, it, expect } from 'vitest';
import {
    validateHubAndSpoke,
    isHubAgent,
    isSpokeAgent,
    HUB_AGENT_ID,
    SPOKE_AGENT_IDS,
    VALID_AGENT_IDS
} from '../types';
import { INDII_MESSAGES } from '../constants';

describe('Hub-and-Spoke Architecture', () => {
    describe('Agent Identification', () => {
        it('identifies generalist as hub agent', () => {
            expect(isHubAgent('generalist')).toBe(true);
            expect(isHubAgent(HUB_AGENT_ID)).toBe(true);
        });

        it('identifies all specialists as spoke agents', () => {
            const specialists = ['marketing', 'legal', 'finance', 'video', 'brand'];
            specialists.forEach(agentId => {
                expect(isSpokeAgent(agentId)).toBe(true);
            });
        });

        it('does not identify hub as spoke', () => {
            expect(isSpokeAgent('generalist')).toBe(false);
            expect(isSpokeAgent(HUB_AGENT_ID)).toBe(false);
        });

        it('does not identify spoke as hub', () => {
            expect(isHubAgent('marketing')).toBe(false);
            expect(isHubAgent('legal')).toBe(false);
        });

        it('SPOKE_AGENT_IDS excludes hub agent', () => {
            expect(SPOKE_AGENT_IDS).not.toContain(HUB_AGENT_ID);
            expect(SPOKE_AGENT_IDS).not.toContain('generalist');
        });

        it('SPOKE_AGENT_IDS includes all specialists', () => {
            const expectedSpokes = VALID_AGENT_IDS.filter(id => id !== 'generalist');
            expect(SPOKE_AGENT_IDS).toEqual(expectedSpokes);
        });
    });

    describe('Hub Delegation Rules', () => {
        it('allows hub to delegate to any specialist', () => {
            const specialists = ['marketing', 'legal', 'finance', 'video', 'brand', 'social'];
            specialists.forEach(specialist => {
                const result = validateHubAndSpoke('generalist', specialist);
                expect(result).toBeNull();
            });
        });

        it('allows hub to delegate to itself (generalist)', () => {
            const result = validateHubAndSpoke('generalist', 'generalist');
            expect(result).toBeNull();
        });

        it('allows hub to delegate to all valid agent IDs', () => {
            VALID_AGENT_IDS.forEach(agentId => {
                const result = validateHubAndSpoke('generalist', agentId);
                expect(result).toBeNull();
            });
        });
    });

    describe('Spoke Delegation Rules', () => {
        it('allows spoke to delegate to hub (generalist)', () => {
            const specialists = ['marketing', 'legal', 'finance', 'video'];
            specialists.forEach(specialist => {
                const result = validateHubAndSpoke(specialist, 'generalist');
                expect(result).toBeNull();
            });
        });

        it('blocks spoke-to-spoke delegation (marketing -> legal)', () => {
            const result = validateHubAndSpoke('marketing', 'legal');
            expect(result).not.toBeNull();
            expect(result).toContain('indii architecture rule');
            expect(result).toContain('marketing');
            expect(result).toContain('legal');
        });

        it('blocks spoke-to-spoke delegation (legal -> finance)', () => {
            const result = validateHubAndSpoke('legal', 'finance');
            expect(result).not.toBeNull();
            expect(result).toContain('indii architecture rule');
        });

        it('blocks spoke-to-spoke delegation (video -> brand)', () => {
            const result = validateHubAndSpoke('video', 'brand');
            expect(result).not.toBeNull();
            expect(result).toContain('indii architecture rule');
        });

        it('blocks spoke self-delegation (marketing -> marketing)', () => {
            const result = validateHubAndSpoke('marketing', 'marketing');
            expect(result).not.toBeNull();
            expect(result).toContain('indii architecture rule');
        });

        it('blocks all spoke-to-spoke combinations', () => {
            const testSpokes = ['marketing', 'legal', 'finance', 'video'];

            testSpokes.forEach(source => {
                testSpokes.forEach(target => {
                    const result = validateHubAndSpoke(source, target);
                    expect(result).not.toBeNull();
                    expect(result).toContain('indii architecture rule');
                });
            });
        });
    });

    describe('indii Branding in Error Messages', () => {
        it('uses indii branding in hub-spoke violation messages', () => {
            const result = validateHubAndSpoke('marketing', 'legal');
            expect(result).toContain('indii architecture rule');
        });

        it('mentions source and target agents in violation', () => {
            const result = validateHubAndSpoke('marketing', 'legal');
            expect(result).toContain('marketing');
            expect(result).toContain('legal');
        });

        it('instructs specialists to delegate to generalist (Agent Zero)', () => {
            const result = validateHubAndSpoke('video', 'finance');
            expect(result).toContain('generalist');
            expect(result).toContain('Agent Zero');
        });

        it('uses INDII_MESSAGES.hubSpokeViolation for consistency', () => {
            const result = validateHubAndSpoke('brand', 'social');
            const expectedMessage = INDII_MESSAGES.hubSpokeViolation('brand', 'social');
            expect(result).toBe(expectedMessage);
        });
    });

    describe('Edge Cases', () => {
        it('handles unknown source agent', () => {
            const result = validateHubAndSpoke('unknown_agent', 'marketing');
            expect(result).not.toBeNull();
            expect(result).toContain('Unknown source agent');
        });

        it('allows hub delegation even with invalid target (validation elsewhere)', () => {
            // Hub delegation validation passes, invalid target ID is caught elsewhere
            const result = validateHubAndSpoke('generalist', 'invalid_target');
            expect(result).toBeNull();
        });

        it('handles case sensitivity correctly', () => {
            // Agent IDs should be lowercase, but test the function behavior
            expect(isHubAgent('generalist')).toBe(true);
            expect(isSpokeAgent('marketing')).toBe(true);
        });

        it('validates road-manager alias as spoke', () => {
            expect(isSpokeAgent('road-manager')).toBe(true);
            const result = validateHubAndSpoke('road-manager', 'generalist');
            expect(result).toBeNull();
        });

        it('blocks road-manager spoke-to-spoke delegation', () => {
            const result = validateHubAndSpoke('road-manager', 'marketing');
            expect(result).not.toBeNull();
            expect(result).toContain('indii architecture rule');
        });
    });

    describe('Comprehensive Delegation Matrix', () => {
        it('validates complete hub-to-all-spokes matrix', () => {
            // Hub can delegate to all spokes
            SPOKE_AGENT_IDS.forEach(spoke => {
                const result = validateHubAndSpoke(HUB_AGENT_ID, spoke);
                expect(result).toBeNull();
            });
        });

        it('validates complete all-spokes-to-hub matrix', () => {
            // All spokes can delegate to hub
            SPOKE_AGENT_IDS.forEach(spoke => {
                const result = validateHubAndSpoke(spoke, HUB_AGENT_ID);
                expect(result).toBeNull();
            });
        });

        it('blocks complete spoke-to-spoke matrix (all combinations)', () => {
            // No spoke can delegate to any other spoke
            SPOKE_AGENT_IDS.forEach(source => {
                SPOKE_AGENT_IDS.forEach(target => {
                    const result = validateHubAndSpoke(source, target);
                    expect(result).not.toBeNull();
                    expect(result).toContain('indii architecture rule');
                });
            });
        });
    });

    describe('Architecture Invariants', () => {
        it('ensures exactly one hub agent exists', () => {
            const hubAgents = VALID_AGENT_IDS.filter(isHubAgent);
            expect(hubAgents).toHaveLength(1);
            expect(hubAgents[0]).toBe('generalist');
        });

        it('ensures all agents are either hub or spoke', () => {
            VALID_AGENT_IDS.forEach(agentId => {
                const isHub = isHubAgent(agentId);
                const isSpoke = isSpokeAgent(agentId);
                // Must be exactly one (XOR)
                expect(isHub !== isSpoke).toBe(true);
            });
        });

        it('ensures spoke count equals total agents minus hub', () => {
            expect(SPOKE_AGENT_IDS.length).toBe(VALID_AGENT_IDS.length - 1);
        });

        it('ensures no overlap between hub and spoke IDs', () => {
            const hubAsArray = [HUB_AGENT_ID];
            const intersection = hubAsArray.filter(id => SPOKE_AGENT_IDS.includes(id as any));
            expect(intersection).toHaveLength(0);
        });
    });

    describe('Real-World Delegation Scenarios', () => {
        it('scenario: Marketing needs legal help - must go through hub', () => {
            // ❌ Marketing cannot directly ask Legal
            const directDelegation = validateHubAndSpoke('marketing', 'legal');
            expect(directDelegation).not.toBeNull();

            // ✅ Marketing asks Generalist (hub)
            const toHub = validateHubAndSpoke('marketing', 'generalist');
            expect(toHub).toBeNull();

            // ✅ Generalist (hub) delegates to Legal
            const hubToLegal = validateHubAndSpoke('generalist', 'legal');
            expect(hubToLegal).toBeNull();
        });

        it('scenario: Finance needs distribution data - hub orchestrates', () => {
            // ❌ Finance cannot directly ask Distribution
            const directDelegation = validateHubAndSpoke('finance', 'distribution');
            expect(directDelegation).not.toBeNull();

            // ✅ Correct flow: Finance -> Hub -> Distribution
            expect(validateHubAndSpoke('finance', 'generalist')).toBeNull();
            expect(validateHubAndSpoke('generalist', 'distribution')).toBeNull();
        });

        it('scenario: Video producer needs brand guidelines from brand agent', () => {
            // ❌ Video cannot directly ask Brand
            const directDelegation = validateHubAndSpoke('video', 'brand');
            expect(directDelegation).not.toBeNull();

            // ✅ Correct flow: Video -> Hub -> Brand
            expect(validateHubAndSpoke('video', 'generalist')).toBeNull();
            expect(validateHubAndSpoke('generalist', 'brand')).toBeNull();
        });

        it('scenario: Hub coordinates multi-agent collaboration', () => {
            // Hub can orchestrate multiple specialists
            const specialists = ['marketing', 'brand', 'social', 'publicist'];

            specialists.forEach(specialist => {
                // ✅ Hub can delegate to each specialist
                expect(validateHubAndSpoke('generalist', specialist)).toBeNull();
            });

            specialists.forEach(source => {
                // ✅ Each specialist can report back to hub
                expect(validateHubAndSpoke(source, 'generalist')).toBeNull();

                // ❌ But specialists cannot talk to each other
                specialists.forEach(target => {
                    if (source !== target) {
                        expect(validateHubAndSpoke(source, target)).not.toBeNull();
                    }
                });
            });
        });
    });

    describe('indii Message Constants', () => {
        it('provides consistent hub-spoke violation messages', () => {
            const msg1 = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');
            const msg2 = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');
            expect(msg1).toBe(msg2);
        });

        it('includes agent names in violation message', () => {
            const message = INDII_MESSAGES.hubSpokeViolation('video', 'finance');
            expect(message).toContain('video');
            expect(message).toContain('finance');
        });

        it('violation message mentions indii branding', () => {
            const message = INDII_MESSAGES.hubSpokeViolation('marketing', 'legal');
            expect(message).toContain('indii');
        });

        it('violation message references Agent Zero', () => {
            const message = INDII_MESSAGES.hubSpokeViolation('brand', 'social');
            expect(message).toContain('Agent Zero');
        });

        it('violation message instructs proper delegation path', () => {
            const message = INDII_MESSAGES.hubSpokeViolation('legal', 'finance');
            expect(message).toContain('generalist');
            expect(message).toContain('coordinate');
        });
    });
});
