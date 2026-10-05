# Browser print GPU readback repair

## Production evidence that selected this repair

`50ad2c6262c8ab9d35a9c1afb1728359999e22a8` reached green CI and production
deployment in run `37232644286`. A genuine journey through https://indii.music/
into https://app.indii.music/creative, using the existing Founding Member seat ii
account, reached `Enhancing tile 1 of 256` for an existing owned square artwork.
The account was not created during this journey and the source was not a fresh
generation. Visible Settings showed lifetime access, pass-through AI costs,
unlimited projects and 10 TB storage.

The actual DOM then reported: `Reading enhanced pixels did not finish in time.
No print master was saved. You can retry or use the desktop app.` The stage
deadline returned the button to idle; history remained 49 and project assets 50.
This identifies the failed operation as `tf.browser.toPixels` readback, after
the tile execution returned its tensor. The exact runtime backend and driver
state were not inspected; GPU fence polling is a source-based explanation,
not a directly observed driver diagnosis.

Installed TensorFlow source corroborates the path: `toPixels` awaits tensor
`data()`, WebGL `read()` awaits `createAndWaitForFence()`, and fence polling uses
a custom scheduling loop. WebGL `readSync()` downloads actual texture values
directly. The production cancellation click was not verified; its observation
timed out. No print download or reload durability was established.

## Repair

- Read the returned model tensor's actual numeric values directly per tile,
  avoiding the observed asynchronous fence/polling path and a second GPU
  round/cast operation.
- Verify that the returned tensor has exactly the padded tile dimensions times
  the selected model scale and three RGB channels before reading it.
- Pack model RGB values in their original channel order, round into canvas
  bytes, and reject invalid dimensions, inconsistent lengths and non-finite or
  out-of-range colors. Output uses an owned ArrayBuffer accepted by ImageData.
- Keep tile alpha opaque while composing RGB, then restore the original source
  alpha through the existing final destination-in operation. Retain the existing
  model, full-resolution upload, focal crop, density tagging and durable save.
- Keep the existing abort checks and event-loop yield between tiles.

Synchronous reads can block until a small tile finishes; timer deadlines cannot
interrupt a blocked synchronous browser/driver call. The 608px maximum tile
edge and exact shape check bound the amount of data read, not driver latency.
Actual responsiveness and successful enhanced pixels require production proof.

## Validation and scope

Pure numeric packing checks use literal numbers and typed arrays, with no GPU,
model, canvas, authentication, customer history or service fixture. The existing
geometry and real-promise/AbortController checks remain separate from customer
acceptance. Legacy repository suites are structural-only.

Jev performed a live source review (5,633 input tokens, 79 output tokens), recorded
in `2026-10-04-jev-print-readback-review.json`. Its typed probabilities are advisory;
no dollar cost was returned and no customer data or credentials were submitted.

Local typecheck passed; root lint passed with zero errors and 217 existing
warnings. The full four-shard CI suite passed with 9,353 tests; the focused
numeric, geometry and real-promise checks passed (27 tests). Touched-file lint
and whitespace checks passed. Exact remote SHA/CI must be reported after delivery.
Successful production enhancement, downloaded 3000px/300 DPI bytes, cancellation,
reload durability, cloud-worker acceptance, fresh generation and free-tier
acceptance remain unverified at publication. The full print plan and two-week
completion goal remain open.
