# Canonical Master Video Render Boundary

This flow maps the music-video render path after the canonical-master hardening.
The browser may retain local or signed preview URLs for timeline playback, but
it never authorizes the cloud renderer to fetch media. Each visual clip carries
a separate owner-scoped canonical source URI, while audio carries a canonical
master identity. The server derives the only renderable audio URI after
verifying the owner, content hash, fingerprint, and immutable Cloud Storage
generation.

```mermaid
flowchart TD
    Client["Renderer: timeline project"] -->|"canonicalSourceUri per video\n+ canonicalMaster identity for audio"| Callable["Firebase renderVideo callable"]
    Client -. "src: local/signed preview URL only\nnever render authority" .-> Preview["Local timeline preview"]

    Callable --> Auth{"Auth + App Check\n+verified email?"}
    Auth -- "deny" --> Denied["Structured callable error\nno queue event"]
    Auth -- "allow" --> Parse["Parse visual canonicalSourceUri\n+ at most one canonical audio master"]
    Parse -- "raw URL / cross-bucket / cross-owner" --> Denied
    Parse --> Verify["verifyMasterAudioObject\nstream + hash + metadata + generation"]
    Verify -- "drift / mismatch" --> Denied
    Verify -- "verified" --> Event["Inngest event\nverified master identity + gs:// URI"]

    Event --> Stitch["stitchVideo worker"]
    Stitch --> SourceGuard["Re-apply visual source policy\nproject bucket + owner prefix"]
    SourceGuard -- "mismatch" --> Failed
    SourceGuard --> Reverify["Re-verify canonical master\nbefore media processing"]
    Reverify -- "mismatch" --> Failed["Mark video job failed\nno output claimed"]
    Reverify -- "verified" --> PassOne["Transcoder pass 1\nconcatenate scene video"]
    PassOne --> PassTwo["Transcoder pass 2\nexplicit stereo master mapping"]
    PassTwo -- "completed" --> Artifact["Final MP4\nmaster replaces native audio"]
    PassTwo -- "failed / timeout" --> Failed

    classDef clientStyle fill:#0F172A,stroke:#00D4FF,stroke-width:2px,color:#F8FAFC;
    classDef gateStyle fill:#1E1B4B,stroke:#D946EF,stroke-width:2px,color:#F8FAFC;
    classDef workerStyle fill:#1C1917,stroke:#FB923C,stroke-width:2px,color:#F8FAFC;
    classDef resultStyle fill:#052E2B,stroke:#2DD4BF,stroke-width:2px,color:#F8FAFC;
    classDef denyStyle fill:#3F0D12,stroke:#FB7185,stroke-width:2px,color:#F8FAFC;

    class Client,Preview clientStyle;
    class Callable,Auth,Parse,Verify,Event gateStyle;
    class Stitch,SourceGuard,Reverify,PassOne,PassTwo workerStyle;
    class Artifact resultStyle;
    class Denied,Failed denyStyle;
```

## Transition rules

1. **Client → callable:** each video clip carries a `canonicalSourceUri` in the configured project bucket under an authenticated-owner prefix. The audio clip carries `canonicalMaster.storagePath`, `contentHash`, `generation`, `masterFingerprint`, and volume. `clip.src` remains local-preview data and is ignored by the callable for render authority.
2. **Admission:** `renderVideo` requires Firebase Auth, App Check, and Firebase's `email_verified` claim before it performs master verification or queues work.
3. **Canonical verification:** the callable accepts only `masters/{uid}/{sha256}/original.wav|flac`. It derives the `gs://` URI from the configured project bucket only after `verifyMasterAudioObject` proves the expected hash, fingerprint, and immutable object generation.
4. **Queue handoff:** asynchronous work receives owner-scoped video `gs://` URIs and the verified master identity, never renderer-controlled download URLs. The stitch worker independently reapplies the visual-source policy and verifies the audio master before using media bytes.
5. **Two Transcoder passes:** first concatenate generated scene videos. Second, use the pass-one MP4 plus the canonical master and explicit left/right audio mappings. The declared policy is truthful: `master_replaces_native`; generated/native scene audio is not represented as mixed until that separate feature has real mapping and verification.
6. **Completion:** only a completed second Transcoder job may set the video job to `completed` and publish its final artifact. Verification failures, Transcoder failures, and timeouts remain failed states.

## Remaining live proof

Local contract tests prove visual-source parsing, owner/hash/generation checks, editor preflight, and the generated Transcoder job configuration. A deployed verified WAV/FLAC project must still prove that the final MP4 has the expected master audio stream, and a crafted visual URI must prove it creates no Transcoder job; those are tracked as ISSUE-1231 and ISSUE-1232 rather than inferred from configuration alone.
