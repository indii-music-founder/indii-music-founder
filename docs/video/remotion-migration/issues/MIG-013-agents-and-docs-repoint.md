# MIG-013: Re-point agents, MCP tools, and docs at the project API

Type: AFK · Blocked by: MIG-001 (can start docs early); coda after MIG-011 · Stories: 7, 9

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Video-producing agents and MCP tools speak `IndiiVideoProject` and the renderer contract;
engine names vanish from operational documentation and skills. Historical/migration docs may
remain only if explicitly archived.

## Acceptance criteria
- [x] Producer SOP re-pointed: description, audio-reactive section, and assembly step now speak `IndiiVideoProject`/pipeline vocabulary — zero engine names in operative instructions
- [x] MCP tool naming/params engine-neutral (`queue_video_render` is the only registered or documented name)
- [x] Canonical video-studio handoff brief updated: contract-first layer statement + migration status pointer (ADR-001/INVENTORY/PARITY_SIGNOFF)
- [x] Historical worksheets (WORKSHEET/MASTER_WORKSHEET Step 6) intentionally left as historical planning records; migration docs supersede
