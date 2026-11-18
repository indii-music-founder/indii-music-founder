import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { Context, Effect, Layer, Option, Schema } from 'effect';
import { describe, expect, it } from 'vitest';

const TrackId = Schema.NonEmptyString.pipe(Schema.brand('TrackId'));

class TrackPayload extends Schema.Class<TrackPayload>('indii/shared/TrackPayload')({
  id: TrackId,
  title: Schema.NonEmptyString,
  isrc: Schema.OptionFromNullishOr(Schema.String),
}) {}

class TrackNotFoundError extends Schema.TaggedError<TrackNotFoundError>()('TrackNotFoundError', {
  trackId: Schema.String,
}) {}

class TrackCatalog extends Context.Service<
  TrackCatalog,
  {
    findById(id: string): Effect.Effect<TrackPayload, TrackNotFoundError>;
  }
>()('indii/shared/TrackCatalog') {
  static readonly layer = Layer.effect(
    TrackCatalog,
    Effect.sync(() => {
      const records = new Map<string, TrackPayload>([
        [
          'trk_001',
          new TrackPayload({
            id: TrackId.make('trk_001'),
            title: 'Midnight Mastering',
            isrc: Option.fromNullishOr('USRC17607839'),
          }),
        ],
      ]);

      return TrackCatalog.of({
        findById: Effect.fn('TrackCatalog.findById')(function* (id: string) {
          const found = Option.fromNullishOr(records.get(id));
          if (Option.isNone(found)) {
            return yield* new TrackNotFoundError({ trackId: id });
          }
          return found.value;
        }),
      });
    })
  );
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('Effect-TS setup & accountability lint rules', () => {
  it('executes Effect.gen, Context.Service, Layer, Option, and Schema decoding', async () => {
    const decodeTrack = Schema.decodeUnknownEffect(TrackPayload);

    const decoded = await Effect.runPromise(
      decodeTrack({
        id: 'trk_002',
        title: 'Analog Tape Mix',
        isrc: null,
      })
    );
    expect(decoded.title).toBe('Analog Tape Mix');
    expect(Option.isNone(decoded.isrc)).toBe(true);

    const resolvedTitle = await Effect.runPromise(
      Effect.gen(function* () {
        const catalog = yield* TrackCatalog;
        const found = yield* catalog.findById('trk_001');
        const missingFallback = yield* catalog.findById('trk_missing').pipe(
          Effect.catchTag('TrackNotFoundError', (err) =>
            Effect.succeed(
              new TrackPayload({
                id: TrackId.make('trk_fallback'),
                title: `Missing:${err.trackId}`,
                isrc: Option.none(),
              })
            )
          )
        );
        return `${found.title} | ${missingFallback.title}`;
      }).pipe(Effect.provide(TrackCatalog.layer))
    );

    expect(resolvedTitle).toBe('Midnight Mastering | Missing:trk_missing');
  });

  it('enforces accountability effect-local lint rules via eslint.config.js', async () => {
    const eslint = new ESLint({ cwd: repoRoot });
    const virtualFile = path.join(repoRoot, 'packages/shared/src/effect/virtual-check.ts');

    const badSample = [
      "import { Effect, Layer, Schema } from 'effect';",
      "declare const eff: Effect.Effect<string, { readonly _tag: 'Err' }>;",
      'declare const baseLayer: Layer.Layer<never>;',
      'declare const depLayer: Layer.Layer<never>;',
      'declare const innerLayer: Layer.Layer<never>;',
      'export const ignored = eff.pipe(Effect.ignore);',
      'export const caughtCause = eff.pipe(Effect.catchAllCause(() => Effect.succeed("x")));',
      "export const swallowed = eff.pipe(Effect.catchTag('Err', () => Effect.void));",
      'export const badSchema = Schema.Struct({ a: Schema.String }).makeUnsafe({ a: "ok" }, { disableValidation: true });',
      'export const nested = Layer.provide(baseLayer, Layer.provide(depLayer, innerLayer));',
    ].join('\n');

    const badResults = await eslint.lintText(badSample, { filePath: virtualFile });
    const ruleIds = new Set(badResults[0]?.messages.map((m) => m.ruleId));

    expect(ruleIds.has('effect-local/no-effect-ignore')).toBe(true);
    expect(ruleIds.has('effect-local/no-effect-catchallcause')).toBe(true);
    expect(ruleIds.has('effect-local/no-silent-error-swallow')).toBe(true);
    expect(ruleIds.has('effect-local/no-disable-validation')).toBe(true);
    expect(ruleIds.has('effect-local/no-nested-layer-provide')).toBe(true);

    const goodSample = [
      "import { Effect, Option } from 'effect';",
      'export function safeWrap(input: string | null): Option.Option<string> {',
      '  return Option.fromNullishOr(input);',
      '}',
      'export const handled = Effect.succeed("ok");',
    ].join('\n');

    const goodResults = await eslint.lintText(goodSample, { filePath: virtualFile });
    const goodErrors = (goodResults[0]?.messages ?? []).filter((m) => m.severity === 2);
    expect(goodErrors).toEqual([]);
  });
});
