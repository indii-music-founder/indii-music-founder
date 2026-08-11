# Vertex Routing Handoff

Status: production deploy in progress from commit `7eea799ee` (`fix: move vertex routing backend-only`).

What changed:
- Backend Vertex client now treats `global`, `us`, and `eu` as valid multi-region locations while using the unprefixed `aiplatform.googleapis.com` host.
- Image generation now defaults to `VERTEX_IMAGE_LOCATION=global`.
- Video generation, long-form video, and tuning utilities now use backend-only `VERTEX_*` envs and the same host normalization.
- Frontend config no longer treats `VITE_VERTEX_*` as production routing inputs.

Keep these envs backend-side only:
- `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION`
- `VERTEX_IMAGE_LOCATION`
- `VERTEX_VIDEO_LOCATION`
- `VERTEX_TUNING_LOCATION`
- `GEMINI_API_KEY`

Do not reintroduce:
- `VITE_VERTEX_PROJECT_ID`
- `VITE_VERTEX_LOCATION`
- raw `https://${location}-aiplatform.googleapis.com` construction for multi-region `us`

Likely next cleanup targets:
- Docs still mentioning old frontend Vertex env names in a few legacy files.
- The broader `VITE_API_KEY` migration, which is separate from this Vertex routing fix.
- The remaining backend script copies of the same URL pattern, if any are still present in generated or utility files.
