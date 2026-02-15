# implementation_plan_ai_refinement.md - AI Response & Type Safety Refinement

## Goal

Improve handling of `thoughtSignature` (Gemini 3 reasoning) and eliminate `as any` type assertions across AI and Distribution services.

## Strategy

1. **Core Types**: Update `ai.dto.ts` to include `thoughtSignature` in all content parts and streaming chunks.
2. **AI Services**: Update `AIService.ts` and `FirebaseAIService.ts` to inject and extract `thoughtSignature` correctly.
3. **Agent Integration**: Ensure `BaseAgent.ts` propagates `thoughtSignature` between turns for function calling continuity.
4. **General Type Safety**:
    - Fix environment variable typing in `vite-env.d.ts`.
    - Harmonize `Project` interfaces in store and dashboard.
    - Resolve IPC payload typing in distribution components.

## Verification

1. `npm run typecheck`: Must have 0 errors.
2. `npm run build`: Verify no regressions in build process.
3. Manual review of `BaseAgent` reasoning propagation.
