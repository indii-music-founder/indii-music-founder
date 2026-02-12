## 2024-05-23 - [VideoGenerationService Schema Validation]

**Learning:** The `VideoGenerationService` validates inputs using Zod (`VideoGenerationOptionsSchema.safeParse(options)`), but it subsequently passes the _raw_ `options` object to the backend Cloud Function (`triggerVideoJob`), rather than the sanitized `validation.data`.
**Action:** In future refactors, update `VideoGenerationService.ts` to use `validation.data` to ensure only schema-compliant fields are transmitted to the backend, preventing potential pollution or side-channel attacks via extra fields.
