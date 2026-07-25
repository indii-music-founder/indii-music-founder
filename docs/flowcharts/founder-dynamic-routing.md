# Founder Marketing Routing, Preview Gate, and Thesis Flowchart

Purpose: Documents how the landing package selects the Founder experience, keeps product entry private by default, records preview intent, and runs the cinematic thesis with a replaceable soundtrack and safe fallback.

## Runtime Flow

```mermaid
flowchart TD
    Request["Visitor opens the landing site"] --> ModeGate{"Founder mode selected?"}
    ModeGate -->|"Founder hostname, localhost, VITE_FOUNDER_MODE=true, or founder query flag"| FounderRoutes["Render FounderRoutes"]
    ModeGate -->|"public=true or general public hostname"| GeneralRoutes["Render GeneralRoutes"]

    FounderRoutes --> FounderHome["Render Home with founder=true"]
    GeneralRoutes --> PublicHome["Render Home with founder=false"]
    FounderRoutes --> SharedRoutes["Authentication, privacy, terms, and field recorder routes"]
    GeneralRoutes --> PublicSharedRoutes["Authentication, privacy, and terms routes"]

    FounderHome --> PreviewGate{"VITE_FOUNDER_PREVIEW_ENABLED is exactly true?"}
    PublicHome --> PreviewGate
    FounderHome --> BrandPromise["State indii is the conductor and the orchestra"]
    BrandPromise --> ProtectedMarks["Render indii, indii.music, and wiil with true lowercase forms"]
    PreviewGate -->|No| ClosedCTA["Show Preview coming soon"]
    ClosedCTA --> StatusAnchor["Navigate locally to #preview-status"]
    PreviewGate -->|Yes| OpenCTA["Resolve Studio preview URL"]
    OpenCTA --> Studio["Open Studio in a new protected tab"]

    ClosedCTA --> Funnel["Track founder_preview_cta_clicked"]
    OpenCTA --> Funnel
    Funnel --> TargetLabel{"Preview target"}
    TargetLabel -->|Closed| ComingSoonTarget["target = coming_soon"]
    TargetLabel -->|Open| StudioTarget["target = studio"]

    FounderHome --> ThesisButton["Visitor selects Watch the thesis"]
    ThesisButton --> ThesisModal["Open ThesisCrawl and lock page scroll"]
    ThesisModal --> Intro["Run six-second opening statement"]
    Intro --> LogoReveal["Run 3.8-second indii.music reveal"]
    LogoReveal --> Crawl["Move thesis at pixels-per-second timing"]
    Crawl --> EndCard["Hold final wiil, Founder end card"]

    ThesisModal --> AudioAction{"Visitor enables sound"}
    AudioAction --> AudioCandidates["Try MP3, then M4A, then WAV"]
    AudioCandidates --> AudioValidation{"Response is successful audio content?"}
    AudioValidation -->|Yes| LoopTrack["Play and loop the supplied soundtrack"]
    AudioValidation -->|No sources succeed| SynthFallback["Start temporary Web Audio synth fallback"]
    LoopTrack --> AudioCleanup["Pause, revoke object URL, and clear audio state on stop or close"]
    SynthFallback --> AudioCleanup
    AudioCleanup --> CloseContext["Stop oscillators and close AudioContext"]

    classDef user fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#111
    classDef logic fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#111
    classDef gate fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#111
    classDef safe fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#111
    classDef closed fill:#fce4ec,stroke:#d81b60,stroke-width:2px,color:#111

    class Request,ThesisButton,AudioAction user
    class FounderRoutes,GeneralRoutes,FounderHome,PublicHome,SharedRoutes,PublicSharedRoutes,BrandPromise,ProtectedMarks,ThesisModal,Intro,LogoReveal,Crawl,EndCard,Funnel logic
    class ModeGate,PreviewGate,TargetLabel,AudioValidation gate
    class OpenCTA,Studio,StudioTarget,LoopTrack,AudioCleanup,CloseContext safe
    class ClosedCTA,StatusAnchor,ComingSoonTarget,SynthFallback closed
```

## Transition Breakdown

1. **Select the route tree.** `packages/landing/src/App.tsx` evaluates `VITE_FOUNDER_MODE`, the current hostname, localhost, and the `founder=true` or `thesis=true` query flags. `public=true` is the explicit override. Founder mode renders `Home` with its default `founder=true`; public mode passes `founder=false`.
2. **Resolve product access fail-closed.** `packages/landing/src/lib/previewAccess.ts` returns `true` only when `import.meta.env.VITE_FOUNDER_PREVIEW_ENABLED === 'true'`. Missing, blank, or differently cased values remain closed. `packages/landing/src/lib/previewAccess.test.ts` proves both the default-closed and explicit-open cases.
3. **Keep closed CTAs useful.** When preview access is closed, both preview pills retain their visual weight and link to the local `#preview-status` section. No Studio URL, new tab, or application session is exposed. When access is explicitly enabled, `getStudioPreviewUrl()` supplies the external destination and the link adds `noopener noreferrer`.
4. **Record honest funnel intent.** Every preview click sends `founder_preview_cta_clicked` with its UI location and a target of either `coming_soon` or `studio`. Analytics therefore distinguish interest from actual product entry.
5. **State the product identity precisely.** The marketing Conductor section, thesis, preview sign-in copy, and in-app brand description all explain the same distinction: indii is both the conductor that receives the artist's direction and the connected orchestra that carries the work. The Conductor is not presented as a separate product.
6. **Protect the lowercase marks.** Visible uses spell `indii`, `indii.music`, and `wiil` exactly in lowercase. The `.indii-name` and `.wiil-name` treatments supply true lowercase glyphs and override inherited uppercase transforms without forcing surrounding labels into lowercase.
7. **Run the thesis sequence.** Opening `ThesisCrawl` locks background scrolling, resets the sequence, runs the opening statement for `6000` milliseconds, reveals the logo for `3800` milliseconds, then advances the crawl using elapsed frame time and `CRAWL_PIXELS_PER_SECOND`. Completion holds the signed end card rather than looping the animation.
8. **Resolve soundtrack sources safely.** Sound begins only after a visitor gesture. The component tries `/audio/indii-thesis-theme.mp3`, `.m4a`, and `.wav` in that order, confirms the response is successful and has an audio content type, then loops the first playable asset.
9. **Degrade and clean up.** If no supplied track can play, a temporary Web Audio synth is used. Pausing, muting, replaying, closing, or unmounting stops media, revokes object URLs, stops oscillators, closes the `AudioContext`, restores page scrolling, and prevents leaked audio resources.

## Verified Files

- `packages/landing/src/App.tsx`
- `packages/landing/src/page.tsx`
- `packages/landing/src/lib/previewAccess.ts`
- `packages/landing/src/lib/previewAccess.test.ts`
- `packages/landing/src/components/ThesisCrawl.tsx`
- `packages/landing/src/components/ConductorSection.tsx`
- `packages/landing/src/globals.css`
- `packages/renderer/src/services/agent/constants.ts`
- `agents/conductor/prompt.md`
- `directives/brand_voice_and_copy.md`
- `packages/landing/public/audio/README.txt`
- `packages/landing/vite.config.ts`
