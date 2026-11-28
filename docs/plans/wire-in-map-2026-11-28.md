# Wire-in map — 2026-11-28

Tracking: ISSUE-1727 in `.agent/test_ledger/OPEN_ISSUES_V4.md`. Source list: the 109 never-imported renderer files from the dead-code scan.

**How to read this:** "Jev's call" is TypeSafe Jev's classification from each file's source, whether its own imports are live, and live files with similar names. Below 0.65 confidence it is a hint, not a finding; Jev was wrong on several files I checked by hand (marked ✔). Wire a file only after confirming its data source is live and a host screen or caller exists. Otherwise it becomes a dead or misleading control.

Jev: 10 calls, 147,861 input / 6,381 output tokens.

## Ready to wire (43)

| Conf. | Lines | File (under `packages/renderer/src/`) | Status |
| ---: | ---: | --- | --- |
| 0.94 | 166 | `modules/dashboard/components/RecentProjects.tsx` | ✅ wired (W1–W2) |
| 0.92 | 49 | `core/components/ui/ThemeToggle.tsx` | ✔ verified: blocked — no light-theme CSS |
| 0.92 | 42 | `modules/debug/useErrorReporting.ts` | ✅ wired (W3) |
| 0.92 | 114 | `services/marketing/CommunityWebhookService.ts` | ✔ verified: needs backend — CSP blocks webhook hosts |
| 0.90 | 101 | `core/components/SidecarStatus.tsx` | ✔ verified: blocked — nothing reports sidecar health |
| 0.86 | 69 | `modules/dashboard/components/ChatMessages.tsx` | ✔ verified: superseded — live chat components |
| 0.85 | 113 | `components/layout/ModuleDashboard.tsx` | ✔ verified: superseded — AdaptiveWorkspace |
| 0.85 | 101 | `components/shared/SessionTimeoutOverlay.tsx` | ✔ verified: blocked — click-to-dismiss, needs re-auth design |
| 0.85 | 75 | `modules/merchandise/hooks/usePerformanceMonitor.ts` |  |
| 0.79 | 152 | `modules/dashboard/components/OrganizationSelector.tsx` | ✔ verified: product call — org switching is dev-gated |
| 0.76 | 69 | `core/components/ApiKeyErrorModal.tsx` | ✔ verified: obsolete — client API keys removed |
| 0.74 | 192 | `modules/observability/components/CircuitBreakerPanel.tsx` | ✅ wired (W1–W2) |
| 0.71 | 152 | `components/shared/DoNotSellToggle.tsx` | ✔ verified: blocked — nothing honours the flag yet |
| 0.69 | 142 | `modules/creative/components/veo/VeoSettingsPanel.tsx` | ✔ verified: superseded — DirectGenerationTab |
| 0.68 | 92 | `modules/settings/components/DownloadHub.tsx` | ✅ wired (W1–W2) |
| 0.64 | 60 | `modules/publishing/hooks/useDistributorConnections.ts` | ✔ verified: superseded — distribution (ISSUE-1441) |
| 0.62 | 222 | `modules/creative/components/ImageSubMenu.tsx` |  |
| 0.61 | 199 | `modules/social/components/UserProfileHeader.tsx` | ✅ wired (W3) |
| 0.59 | 31 | `hooks/useLanguage.ts` | ✅ wired (W1–W2) |
| 0.57 | 81 | `modules/merchandise/components/RecentDesignItem.tsx` |  |
| 0.47 | 376 | `modules/marketing/components/IntelligenceEnhancePostModal.tsx` | ✅ wired (W3) |
| 0.46 | 97 | `services/legal/ContractSnippetStore.ts` |  |
| 0.41 | 228 | `components/agent/ReflectionPanel.tsx` |  |
| 0.41 | 21 | `modules/core/components/CinematicTransition.tsx` |  |
| 0.41 | 102 | `modules/dashboard/components/DataStorageManager.tsx` | ✅ wired (W1–W2) |
| 0.41 | 74 | `services/creative/EPKGeneratorService.ts` |  |
| 0.39 | 99 | `modules/dashboard/components/StatsRibbon.tsx` | ✅ wired (W1–W2) |
| 0.37 | 182 | `modules/publishing/components/MultiDistributorProgress.tsx` |  |
| 0.35 | 110 | `modules/merchandise/components/ScenarioBuilder.tsx` |  |
| 0.34 | 43 | `services/intelligence/OCRService.ts` |  |
| 0.31 | 36 | `modules/publishing/hooks/useEarnings.ts` | ✔ verified: superseded — finance (ISSUE-1441) |
| 0.31 | 194 | `service-worker.ts` |  |
| 0.30 | 54 | `modules/marketing/hooks/useTrackIngestion.ts` |  |
| 0.30 | 121 | `services/agent/orchestration/NegotiationOrchestrator.ts` |  |
| 0.29 | 71 | `modules/dashboard/components/KnowledgeBaseList.tsx` | ✅ wired (W1–W2) |
| 0.25 | 187 | `services/security/PrivateVaultService.ts` |  |
| 0.25 | 66 | `services/video/VideoRenderOrchestrator.ts` |  |
| 0.24 | 83 | `modules/creative/video/components/BriefingStep.tsx` |  |
| 0.24 | 27 | `services/audio/AudioVisualDirectionService.ts` |  |
| 0.24 | 91 | `services/image/IntelligenceImagePromptService.ts` |  |
| 0.24 | 90 | `services/knowledge/SamplePlatforms.ts` |  |
| 0.21 | 94 | `services/agent/orchestration/MastraService.ts` |  |
| 0.12 | 33 | `modules/core/components/RateLimitBackpressure.tsx` |  |

## Needs backend/consumer first (47)

| Conf. | Lines | File (under `packages/renderer/src/`) | Status |
| ---: | ---: | --- | --- |
| 0.99 | 115 | `services/legal/DigitalSignatureService.ts` |  |
| 0.98 | 63 | `services/audio/CopyrightFilterService.ts` |  |
| 0.91 | 74 | `services/marketing/PrintDispatchService.ts` |  |
| 0.90 | 264 | `services/distribution/YouTubeDataService.ts` |  |
| 0.89 | 97 | `hooks/useSonicBridge.ts` |  |
| 0.89 | 89 | `services/legal/NotarizeService.ts` |  |
| 0.87 | 147 | `modules/onboarding/components/WhiteGloveIngestionHub.tsx` | ✔ verified: needs rules + results view |
| 0.85 | 104 | `services/social/SocialPostingService.ts` |  |
| 0.82 | 128 | `services/distribution/proprietary-ingestion/EarningsProcessor.ts` |  |
| 0.80 | 316 | `modules/observability/components/SchedulerStatusPanel.tsx` | ✅ wired (W1–W2) |
| 0.80 | 147 | `services/distribution/proprietary-ingestion/IngestionIdentity.ts` |  |
| 0.79 | 103 | `services/distribution/BatchDeliveryService.ts` |  |
| 0.79 | 61 | `services/finance/MultiCurrencyService.ts` |  |
| 0.77 | 133 | `services/legal/PandaDocService.ts` |  |
| 0.75 | 194 | `components/agent/StreamingAgentCard.tsx` |  |
| 0.75 | 116 | `services/publishing/LODService.ts` |  |
| 0.73 | 81 | `services/agent/AgentAPIClient.ts` |  |
| 0.69 | 131 | `services/collaboration/CollaborationService.ts` |  |
| 0.69 | 43 | `services/distribution/SubmissionTriageService.ts` |  |
| 0.68 | 108 | `services/distribution/distrokid/DistroKidPackageBuilder.ts` |  |
| 0.66 | 282 | `services/agent/AgentContextBridge.ts` |  |
| 0.66 | 184 | `types/UserMemory.ts` |  |
| 0.64 | 107 | `services/distribution/cdbaby/CDBabyPackageBuilder.ts` |  |
| 0.57 | 251 | `services/security/CEOSyncService.ts` |  |
| 0.56 | 43 | `components/shared/LanguageSelector.tsx` | ✅ wired (W1–W2) |
| 0.55 | 132 | `modules/merchandise/components/ShowroomStage.tsx` |  |
| 0.55 | 84 | `services/audio/ClientPitchTracker.ts` |  |
| 0.55 | 105 | `services/distribution/VinylPressingService.ts` |  |
| 0.52 | 101 | `modules/agent/components/SecurityDashboard.tsx` |  |
| 0.52 | 50 | `services/catalog/SemanticCatalogFilterService.ts` |  |
| 0.51 | 61 | `modules/merchandise/components/PerformanceOverlay.tsx` |  |
| 0.47 | 117 | `services/legal/LegalAuditService.ts` |  |
| 0.42 | 38 | `modules/touring/hooks/useTourGeo.ts` |  |
| 0.42 | 215 | `services/agent/SessionTools.ts` |  |
| 0.40 | 191 | `services/agent/IndiiNucleus.ts` |  |
| 0.37 | 233 | `services/distribution/proprietary-ingestion/validation/ingestionSchema.ts` |  |
| 0.35 | 247 | `services/video/VeoTimelineIngestBridge.ts` |  |
| 0.32 | 61 | `modules/marketing/tools.ts` |  |
| 0.32 | 237 | `services/agent/memory/MemoryInboxWatcher.ts` |  |
| 0.32 | 242 | `services/intelligence/M5LocalFirstService.ts` |  |
| 0.31 | 131 | `services/analytics/EventBusService.ts` |  |
| 0.27 | 51 | `hooks/usePowerMonitor.ts` |  |
| 0.26 | 484 | `services/agent/memory/MemorySearch.ts` |  |
| 0.26 | 70 | `services/agent/memory/WikiLinter.ts` |  |
| 0.26 | 60 | `services/distribution/types/persistence.ts` |  |
| 0.25 | 71 | `services/legal/LegalArchiverService.ts` |  |
| 0.24 | 102 | `services/distribution/symphonic/SymphonicPackageBuilder.ts` |  |

## Live twin exists (3)

| Conf. | Lines | File (under `packages/renderer/src/`) | Status |
| ---: | ---: | --- | --- |
| 0.21 | 128 | `modules/distribution/components/ReleaseStatusList.tsx` | ✔ verified: superseded — ReleaseStatusCard |
| 0.15 | 210 | `core/theme/departmentRegistry.ts` |  |
| 0.06 | 58 | `services/intelligence/graph/types.ts` |  |

## Decorative/stub (8)

| Conf. | Lines | File (under `packages/renderer/src/`) | Status |
| ---: | ---: | --- | --- |
| 0.95 | 32 | `modules/desktop/components/DesktopWidget.tsx` |  |
| 0.92 | 54 | `modules/core/components/GodModeCanvas.tsx` |  |
| 0.86 | 63 | `modules/core/components/GenerativeUIMorpher.tsx` |  |
| 0.59 | 93 | `services/intelligence/graph/AgentGraphService.ts` |  |
| 0.56 | 33 | `modules/publicist/components/StatsTicker.tsx` |  |
| 0.42 | 169 | `modules/touring/services/TourGeoService.ts` |  |
| 0.42 | 194 | `services/audio/export/DAWExportService.ts` |  |
| 0.36 | 168 | `services/agent/WorkflowCoordinator.ts` |  |

## Unclear (8)

| Conf. | Lines | File (under `packages/renderer/src/`) | Status |
| ---: | ---: | --- | --- |
| 0.62 | 188 | `hooks/useGestures.ts` |  |
| 0.50 | 49 | `modules/creative/video/components/IdeaStep.tsx` |  |
| 0.36 | 60 | `hooks/useE2EEncryption.ts` |  |
| 0.36 | 218 | `modules/merchandise/components/MerchCanvas.tsx` |  |
| 0.36 | 113 | `modules/publishing/components/EarningsBreakdown.tsx` | ✔ verified: superseded — finance EarningsDashboard (ISSUE-1441) |
| 0.35 | 50 | `hooks/useNetworkQuality.ts` |  |
| 0.30 | 268 | `modules/distribution/components/TerritoryRightsPanel.tsx` | ✔ verified: blocked — DDEX builder ignores territory splits |
| 0.21 | 238 | `services/design/templates.ts` |  |
## Restored helpers from the deleted prune branch (20)

These were removed on `claude/prune-unreachable-renderer` (deleted 2026-11-28 unmerged; the files are still on `main`). They stay on `main` and are triaged here so the map covers everything.

| Lines | File (under `packages/renderer/src/`) | Status |
| ---: | --- | --- |
| 102 | `utils/test-harness.ts` | ✔ verified: do not wire. It is a store backdoor that skips the agent to force views; dev-only. |
| — | `services/distribution/proprietary-ingestion/DDEXStressTest.ts` | ✔ verified: stub that only returns `SKIPPED` |
| — | `modules/distribution/verify-ui.ts` | ✔ verified: dry-run dev script, not app code |
| — | `services/security/verify-credentials.ts` | ✔ verified: dev script with fake credentials, not app code |
| — | `lib/promptSanitizer.ts` | Possible twin of `services/intelligence/utils/InputSanitizer`; compare before wiring |
| — | `services/intelligence/observability/TraceService.ts` | Twin of live `services/agent/observability/TraceService.ts` |
| — | `components/shared/GlobalKeyboardShortcuts2.tsx` | Twin of live `components/shared/GlobalKeyboardShortcuts.tsx` |
| — | `hooks/useReducedMotion.ts`, `hooks/useVirtualList.ts`, `hooks/useLazyLoad.tsx`, `hooks/useKeyboardNav.ts`, `hooks/useSessionTimeout.ts` | Generic hooks; wire where a screen needs them |
| — | `lib/formatters.ts`, `utils/geocode.ts`, `utils/classNameUtils.ts`, `core/config/branding.ts` | Generic helpers; wire where a screen needs them |
| — | `services/analytics/analytics-queries.ts`, `services/agent/tools/shared/ToolValidator.ts`, `services/agent/specialists/debug-tools.ts`, `modules/registration/adapters/automationResult.ts` | Unverified; check for a live caller before wiring |
