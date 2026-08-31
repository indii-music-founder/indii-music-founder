# Background Removal Model Weights — License Record

Vendored for `@imgly/background-removal@1.7.0`.

- **Library code license:** AGPL-3.0 — see `node_modules/@imgly/background-removal/LICENSE.md`.
  Used **unmodified** via npm as a separate dependency; no source changes.
- **Model weights (ONNX) + WASM runtime:** © IMG.LY GmbH, distributed by IMG.LY for
  self-hosting under the package's terms. These files are **not** open-source —
  do not redistribute outside indii. (~285MB; gitignored, fetched by
  `scripts/vendor-imgly-weights.mjs`.)
- **Founder decision:** APPROVED 2026-08-31 (recorded in `.agent/FOUNDER_BLOCKERS.md` #4).
  A commercial license may be required instead of AGPL for a closed-source product —
  contact `support@img.ly` for that option.
- **Regen:** `node scripts/vendor-imgly-weights.mjs`
