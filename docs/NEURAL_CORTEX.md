# Neural Cortex: Semantic Visual Memory Core

## Overview
The Neural Cortex is a vector-based imagination system that keeps indii's visual storytelling coherent over
long story chains. Rather than relying on pixel references alone, it encodes the narrative intent and semantic
identity of characters, locations, and props so regenerated frames stay faithful to the story bible and prior
scenes.

## Objectives
- **Eliminate visual drift:** Maintain consistent physical traits, costumes, lighting, and spatial relationships
  for recurring subjects across long sequences.
- **Capture intent, not just appearance:** Preserve narrative roles, moods, and relationships so visuals reflect
  character arcs and scene beats instead of frozen keyframes.
- **Bridge agents and renderers:** Give Director/Creative Director agents a shared semantic memory that
  downstream image/video models can query for anchors, constraints, and style references.

## Core Concepts
- **Entity Profiles:** Canonical records for each character, location, and prop with attributes (visual
  descriptors, backstory, pose vocabularies), exemplar assets, and textual prompts distilled from the Show Bible.
- **Multimodal Embeddings:** Embeddings derived from text, reference images, sketches, and storyboard panels
  stored in a vector index. Each embedding is tagged with role, emotional tone, lighting context, camera
  treatment, and timepoint.
- **Narrative Anchors:** Time-aware constraints (e.g., "episode 3, scene 4" or "post-fall battle damage") that
  tie Entity Profiles to specific beats, costumes, and prop states.
- **Scene Graph Snapshots:** For each beat, a semantic graph tracks who is present, their relationships, relative
  placement, and key actions. Snapshots are serialized into prompts that accompany rendering requests.
- **Similarity & Drift Detection:** Retrieval compares planned shots against prior embeddings to flag drift
  (pose mismatch, color shifts, wardrobe errors) before generation. Agents can auto-correct prompts or request
  restorative inpainting.

## Data Flow
1. **Ingest:** The Show Bible, Character Anchors, and Director's Board storyboards populate Entity Profiles and
   seed embeddings.
2. **Contextualize:** When a Story Chain step starts, the Cortex retrieves relevant embeddings by entity, beat,
   and mood, assembling a scene graph snapshot.
3. **Synthesize Prompts:** The snapshot is converted into structured prompts (who/where/when/how-to-shoot) plus
   negative constraints drawn from drift detection.
4. **Generate & Validate:** Generated frames are embedded and re-indexed. Drift checks compare them against the
   expected snapshot; deviations trigger automated revisions or Director agent feedback.

## Interfaces
- **`getSceneContext(projectId, sceneId)`** → Returns Entity Profiles, relevant embeddings, and narrative anchors
  for the scene.
- **`buildRenderDirectives(snapshot)`** → Produces structured prompts and constraints for the rendering model,
  including camera directives and continuity notes.
- **`recordFrame(sceneId, metadata, assets)`** → Embeds outputs, updates drift scores, and links assets back to
  Entity Profiles.

## Integration Points
- **Generalist/Director Agents:** Use Cortex retrieval to ground their shot planning and enforce continuity rules
  from the Show Bible.
- **Infinite Reel & Daisy-Chains:** Each chained beat rehydrates the last snapshot, so transitions inherit
  identities and spatial layouts rather than re-deriving them from scratch.
- **Character Anchor & Product Showroom:** Cortex embeddings act as the unified identity layer for both character
  and product renders, enabling style transfer without losing semantic identity.

## Authenticity & Data Integrity
- **No mocked context:** All retrievals must operate on real Show Bible entries, production assets, and storyboard
  metadata. Test harnesses should rely on fully-specified fixtures that mirror production schemas rather than
  dummy placeholders.
- **Provenance-first writes:** Every embedding and snapshot stores source asset IDs, authorship, and timestamps so
  reviewers can confirm continuity decisions are grounded in real inputs.
- **Tunable trust gates:** Drift alerts should fail closed when required inputs are missing, preventing the system
  from hallucinating continuity based on incomplete or fabricated data.

## Verification & QA
- **Preflight asset checks:** Rendering requests must validate that referenced Show Bible entries, storyboard panels,
  and exemplar assets exist and are approved before Cortex retrieval begins; otherwise the request is rejected with a
  fail-closed error.
- **Integration tests with real schemas:** Automated tests should run against production-shaped fixtures (no dummy
  strings or placeholder IDs) to prove the Cortex reads/writes the same shapes it will receive in production.
- **Drift regression harness:** Add regression cases where assets are intentionally missing or altered; assert the
  trust gates block generation and surface provenance gaps instead of falling back to mocked continuity.

## Implementation Notes
- Start with existing RAG/semantic retrieval infrastructure; extend schemas to store multimodal embeddings keyed
  by entity and beat.
- Favor transformer-based vision-language models that support both text and image embeddings for cross-modal
  retrieval.
- Store provenance metadata (asset IDs, storyboard frame references, artist notes) to enable explainability and
  human override when drift checks fire.
