# task_ai_refinement.md - AI & Type Safety Refinement

- [x] **Core Types**: Add `thoughtSignature` to `ContentPart` types in `ai.dto.ts`. <!-- id: 0 -->
- [x] **Core Types**: Add `thoughtSignature` to `StreamChunk` in `ai.dto.ts`. <!-- id: 1 -->
- [x] **AI Service**: Implement `thoughtSignature` extraction in `wrapResponse`. <!-- id: 2 -->
- [x] **AI Service**: Inject `thoughtSignature` into `generateContent` and `generateContentStream` payloads. <!-- id: 3 -->
- [x] **Firebase AI Service**: Update `generateWithFallback` to handle `thoughtSignature`. <!-- id: 4 -->
- [x] **Agent Service**: Remove `as any` from `AI.generateContent` calls in `BaseAgent`. <!-- id: 5 -->
- [x] **Agent Service**: Implement thought continuity in `BaseAgent` execution loop. <!-- id: 6 -->
- [x] **Infra**: Add `VITE_API_URL` to `ImportMetaEnv` for typed access. <!-- id: 7 -->
- [x] **Dashboard**: Remove `as any` mapping in `DashboardService`. <!-- id: 8 -->
- [x] **Distribution**: Fix UPC type mismatch and remove `as any` in `AuthorityPanel`. <!-- id: 9 -->
- [x] **Verification**: Run `npm run typecheck` and ensure 0 errors. <!-- id: 10 -->
- [x] **Final**: Run `npm run build` to ensure production readiness. <!-- id: 11 -->
