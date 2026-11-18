# Effect-TS Guide (indii.music)

This guide defines the Effect-TS patterns, lint rules, and diagnostics tooling configured in `indii-music-founder`, adapted from [mikearnaldi/accountability](https://github.com/mikearnaldi/accountability) and aligned with Effect v4 (`effect@^4.1.4` in `repos/effect/`).

> Before writing non-trivial Effect code, read [`repos/effect/LLMS.md`](../../repos/effect/LLMS.md) (run `npm run effect:sync-repo` if `repos/effect/` is not yet cloned locally).

---

## 1. Critical Rules (Enforced by ESLint)

`eslint.config.js` includes the `effect-local` plugin enforcing these rules across all `.ts` and `.tsx` files:

1. **Never bypass Schema validation (`effect-local/no-disable-validation`)**
   - `{ disableValidation: true }` is banned. Fix incoming payloads or schemas instead of disabling validation.
2. **Never silently ignore errors (`effect-local/no-effect-ignore`)**
   - `Effect.ignore` discards typed errors and hides bugs. Handle errors explicitly with `Effect.catchTag`, `Effect.catchTags`, `Effect.catch`, or let them propagate.
3. **Never catch defects indiscriminately (`effect-local/no-effect-catchallcause`)**
   - `Effect.catchAllCause` and `Effect.catchCause` catch unexpected defects (bugs) alongside expected domain errors. Use `Effect.catch`, `Effect.catchTag`, or `Effect.mapError` for expected errors only.
4. **Never swallow errors into `Effect.void` (`effect-local/no-silent-error-swallow`)**
   - Patterns like `Effect.catchTag('SomeError', () => Effect.void)`, `Effect.catch(() => Effect.void)`, `Effect.catchAll(() => Effect.void)`, or `Effect.catchTags({ Foo: () => Effect.void })` are errors. Recover meaningfully, log and map to a domain error, or propagate.
5. **Never make required services optional (`effect-local/no-service-option`)**
   - `Effect.serviceOption` makes it easy to forget providing dependencies. Yield services directly (`yield* MyService`) and provide test/live layers cleanly.
6. **Never nest `Layer.provide` (`effect-local/no-nested-layer-provide`)**
   - Extract inner `Layer.provide(...)` compositions into named intermediate layers or use `Layer.provideMerge`.
7. **Prefer `Option.fromNullishOr` (`effect-local/prefer-option-from-nullable`)**
   - Write `Option.fromNullishOr(value)` (Effect v4 replacement for v3's `Option.fromNullable`; or `Option.fromNullOr` / `Option.fromUndefinedOr`) instead of `value !== null ? Option.some(value) : Option.none()`.
8. **Avoid `Effect.asVoid` (`effect-local/no-effect-asvoid`)**
   - Prefer `Effect.gen` blocks that return without a value, or explicit `Effect.map(() => undefined)` when converting an expression result to `void`.
9. **Keep `.pipe()` chains readable (`effect-local/pipe-max-arguments`)**
   - Split `.pipe(...)` calls exceeding 20 arguments into smaller chained `.pipe()` calls or well-named helpers.

Additional non-ESLint discipline:
- Never use `any` or unsafe type assertions (`as`) inside Effect boundaries — use `Schema.decodeUnknownEffect`, `Schema.is`, `Predicate`, or `identity<T>()`.
- Never put plain `new Error(...)` in an Effect's error channel `E` — use `Schema.TaggedError`.

---

## 2. Writing Effects (`Effect.gen`, `Effect.fn`, `Effect.fnUntraced`)

Prefer `Effect.gen` for inline Effect code and `Effect.fn('Service.method')` for reusable traced functions (or `Effect.fnUntraced` in hot paths). Avoid functions that merely wrap and return `Effect.gen(...)`.

```typescript
import { Effect, Schema } from 'effect';

export class TrackProcessingError extends Schema.TaggedError<TrackProcessingError>()(
  'TrackProcessingError',
  {
    trackId: Schema.String,
    message: Schema.String,
  }
) {}

export const processTrack = Effect.fn('processTrack')(
  function* (trackId: string): Effect.fn.Return<string, TrackProcessingError> {
    if (!trackId.trim()) {
      return yield* new TrackProcessingError({
        trackId,
        message: 'Track ID must not be empty',
      });
    }
    yield* Effect.logInfo(`Processing track ${trackId}`);
    return trackId.trim();
  },
  Effect.annotateLogs({ operation: 'processTrack' })
);
```

Always `return yield* new MyTaggedError(...)` when failing inside a generator so TypeScript narrows control flow cleanly.

---

## 3. Domain Modeling with `Schema`

Use `Schema.Class`, `Schema.brand`, and `Schema.TaggedError` for validated domain entities, nominal IDs, and typed errors:

```typescript
import { Schema } from 'effect';

export const ReleaseId = Schema.NonEmptyString.pipe(Schema.brand('ReleaseId'));
export type ReleaseId = typeof ReleaseId.Type;

export class ReleaseSummary extends Schema.Class<ReleaseSummary>('indii/shared/ReleaseSummary')({
  id: ReleaseId,
  title: Schema.NonEmptyString,
  status: Schema.Literals(['draft', 'scheduled', 'live']),
  upc: Schema.OptionFromNullishOr(Schema.String),
}) {
  get isPublished(): boolean {
    return this.status === 'live';
  }
}

export type ReleaseSummaryType = (typeof ReleaseSummary)['Type'];
export type ReleaseSummaryEncoded = (typeof ReleaseSummary)['Encoded'];

export const decodeReleaseSummary = Schema.decodeUnknownEffect(ReleaseSummary);
export const isReleaseSummary = Schema.is(ReleaseSummary);
```

Notes for Effect v4:
- Use `Schema.decodeUnknownEffect(MySchema)(input)` inside Effects so decode issues remain typed in the error channel.
- Use `Schema.OptionFromNullishOr(...)` / `Schema.Option(...)` rather than `*FromSelf` variants for JSON-serializable boundaries.
- Use `Schema.Literals(['a', 'b'])` for string literal unions.

---

## 4. Services & Layers (`Context.Service` + `Layer`)

Define services by extending `Context.Service` and attaching static `Layer` definitions:

```typescript
import { Context, Effect, Layer, Schema } from 'effect';

export class StorageQuotaError extends Schema.TaggedError<StorageQuotaError>()('StorageQuotaError', {
  message: Schema.String,
}) {}

export class AssetStore extends Context.Service<
  AssetStore,
  {
    put(key: string, bytes: Uint8Array): Effect.Effect<void, StorageQuotaError>;
  }
>()('indii/shared/AssetStore') {
  static readonly layer = Layer.effect(
    AssetStore,
    Effect.gen(function* () {
      const put = Effect.fn('AssetStore.put')(function* (key: string, bytes: Uint8Array) {
        if (bytes.byteLength === 0) {
          return yield* new StorageQuotaError({ message: `Empty payload for ${key}` });
        }
        yield* Effect.logDebug(`Stored ${bytes.byteLength} bytes at ${key}`);
      });

      return AssetStore.of({ put });
    })
  );
}
```

### Resource Lifecycle & Composition

- Use `Effect.acquireRelease(acquire, release)` inside `Layer.effect` (or `Layer.scoped`) whenever a service owns sockets, file handles, or child processes.
- Compose layers flatly with `Layer.provide` or `Layer.provideMerge` — never nest `Layer.provide(Layer.provide(...))`.
- Use `Layer.fresh(layer)` only when two separate instances of the same layer reference are explicitly required (layers are memoized by reference identity).

---

## 5. TypeScript Diagnostics (`@effect/language-service` & `@effect/tsgo`)

`tsconfig.json` includes the `@effect/language-service` plugin for IDE quick fixes and Effect-aware diagnostics, and root `package.json` exposes CLI commands:

```bash
# Run Effect language service diagnostics across a tsconfig project
npm run effect:diagnostics

# Run Effect-patched tsgo typechecking (native TS 7 CLI wrapper)
npm run effect:tsgo

# Clone or update local Effect source reference under repos/effect
npm run effect:sync-repo
```

> Note: `indii-music-founder` continues to build and typecheck production workspaces with TypeScript `5.8.x` via `npm run typecheck`. Keep workspace React UI components (`packages/renderer/src/components/`) clean of Effect runtime orchestration per the repository's layered architecture — place Effect services in shared/domain/backend service modules and bridge cleanly at boundaries.
