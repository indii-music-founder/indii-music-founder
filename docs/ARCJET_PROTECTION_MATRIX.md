# Arcjet Protection Inventory (ISSUE-1244 / ISSUE-1543)

Generated from current source with `npm run inventory:arcjet`. Check freshness with `npm run check:arcjet-inventory`.

This replaces the earlier blanket compliance claim. **No row is a runtime protection certification.**

- Trigger declarations: **199** across **103** source files.
- Declarations with both a local guard-call reference and an ARCJET_KEY option reference: **28**.
- Declarations missing at least one of those local references: **171**. These require review; absence of local evidence does not prove the absence of imported middleware.

Scope: non-test TypeScript under `packages/firebase/src`; `onCall`, `onRequest` (including namespace/v1 chains) and imported `defineCallable` / `defineHttps` wrappers. Factory declarations are included and labeled. Event triggers are outside this HTTP inventory; that exclusion makes no IAM or caller-authentication guarantee. This is a source inventory, not a deployed export list.

Evidence rules: inspect each trigger's options and callback, following same-file variable/function references. Guard references must be calls to imported Arcjet helpers; comments, strings and unused imports do not qualify. Secret references must occur within options (following same-file constants), not merely elsewhere in the file. Imported callbacks/options, dynamic factories, control-flow dominance, denial handling, policy selection, deployed secret versions, and live decisions require separate review. A local call reference can be conditional or unreachable and is **not** proof that every request is admitted correctly.

ISSUE-1543 remains open: endpoint admission gaps, device-bound App Check, verified executor enrollment, deployed configuration, and genuine acceptance remain separate requirements. Changes to this inventory cannot close them.

| Source (relative to packages/firebase/src) | Declaration | Trigger | ARCJET_KEY option reference | Local guard-call reference |
|---|---|---|---|---|
| `analytics/platformTokenExchange.ts:80` | `analyticsExchangeToken` | `onCall` | Not established | Not established |
| `analytics/platformTokenExchange.ts:163` | `analyticsFinalizeInstagramConnection` | `onCall` | Not established | Not established |
| `analytics/platformTokenExchange.ts:183` | `analyticsGetConnectionStatus` | `onCall` | Not established | Not established |
| `analytics/platformTokenExchange.ts:221` | `auditInstagramConnectionCallable` | `onCall` | Not established | Not established |
| `analytics/platformTokenExchange.ts:285` | `analyticsRefreshToken` | `onCall` | Not established | Not established |
| `analytics/platformTokenExchange.ts:392` | `analyticsRevokeToken` | `onCall` | Not established | Not established |
| `assets/auditReleaseArtwork.ts:30` | `auditReleaseArtworkForDelivery` | `onCall` | Not established | Not established |
| `distribution/ingestion.ts:223` | `processAudioIngestion` | `onCall` | Not established | Not established |
| `email/sendEmail.ts:285` | `sendEmail` | `onCall` | Not established | Not established |
| `email/tokenManager.ts:164` | `emailExchangeToken` | `onCall` | Not established | Not established |
| `email/tokenManager.ts:274` | `emailRefreshToken` | `onCall` | Not established | Not established |
| `email/tokenManager.ts:372` | `emailRevokeToken` | `onCall` | Not established | Not established |
| `factory.ts:143` | `(factory/helper)` | `onCall` | Not established | Not established |
| `factory.ts:170` | `(factory/helper)` | `onRequest` | Not established | Not established |
| `foundingArtist/admin.ts:261` | `inviteNextFoundingArtist` | `onCall` | Not established | Not established |
| `foundingArtist/admin.ts:266` | `queueFoundingArtistMilestoneUpdate` | `onCall` | Not established | Not established |
| `foundingArtist/waitlist.ts:177` | `joinFoundingArtistWaitlist` | `onCall` | Not established | Not established |
| `functions/agent/getCapabilitySnapshot.ts:327` | `getCapabilitySnapshot` | `onCall` | Present | Not established |
| `functions/agent/manageSemanticMemory.ts:117` | `manageSemanticMemory` | `onCall` | Not established | Not established |
| `functions/agent/manageSemanticMemory.ts:236` | `batchEmbedText` | `onCall` | Not established | Not established |
| `functions/agent/reportBugFn.ts:44` | `reportBugFn` | `onCall` | Not established | Not established |
| `functions/agent/workflowExecutionCallables.ts:59` | `createWorkflowExecution` | `onCall` | Not established | Not established |
| `functions/agent/workflowExecutionCallables.ts:105` | `manageWorkflowExecution` | `onCall` | Not established | Not established |
| `functions/api/router.ts:181` | `getProfile` | `onRequest` | Present | Present |
| `functions/api/router.ts:208` | `health` | `onRequest` | Present | Present |
| `functions/auth/entitlements.ts:375` | `provisionVerifiedFreeEntitlement` | `onCall` | Present | Not established |
| `functions/auth/handoff.ts:120` | `createHandoffCode` | `onRequest` | Not established | Not established |
| `functions/auth/handoff.ts:171` | `redeemHandoffCode` | `onRequest` | Not established | Not established |
| `functions/auth/mintElectronAppCheckToken.ts:17` | `mintElectronAppCheckToken` | `onCall` | Present | Present |
| `functions/billing/enforceOperationCost.ts:923` | `enforceOperationCost` | `onCall` | Present | Present |
| `functions/billing/enforceOperationCost.ts:940` | `voidAgentStreamCostReservation` | `onCall` | Present | Present |
| `functions/billing/enforceOperationCost.ts:958` | `voidVideoCostReservation` | `onCall` | Present | Present |
| `functions/billing/enforceOperationCost.ts:981` | `getOperationCostStatus` | `onCall` | Present | Present |
| `functions/billing/enforceOperationCost.ts:1031` | `getOperationCostHistory` | `onCall` | Present | Present |
| `functions/catalog/semanticProjection.ts:138` | `setCatalogVisibility` | `onCall` | Not established | Not established |
| `functions/catalog/semanticProjection.ts:196` | `catalogSemanticApi` | `onRequest` | Not established | Not established |
| `functions/creative/gateway.ts:1280` | `generateImageV3` | `onCall` | Present | Present |
| `functions/creative/gateway.ts:1590` | `generateVideoV3` | `onCall` | Present | Present |
| `functions/creative/gateway.ts:1831` | `cancelVideoJob` | `onCall` | Present | Present |
| `functions/creative/gateway.ts:2057` | `generateOmniRemixV3` | `onCall` | Present | Present |
| `functions/creative/gateway.ts:2416` | `generateAudioV3` | `onCall` | Present | Present |
| `functions/creative/getMediaDuration.ts:49` | `getMediaDuration` | `onCall` | Not established | Not established |
| `functions/distribution/distributionRecords.ts:229` | `assignDistributionIdentifier` | `onCall` | Not established | Not established |
| `functions/distribution/distributionRecords.ts:260` | `recordDistributionIdentifier` | `onCall` | Not established | Not established |
| `functions/distribution/distributionRecords.ts:308` | `recordDistributionAuditEvent` | `onCall` | Not established | Not established |
| `functions/distribution/distributionRecords.ts:354` | `requestDistributionTakedown` | `onCall` | Not established | Not established |
| `functions/distribution/distributionRecords.ts:411` | `createSftpIngestionRecord` | `onCall` | Not established | Not established |
| `functions/distribution/distributionRecords.ts:433` | `updateSftpIngestionRecord` | `onCall` | Not established | Not established |
| `functions/finance/calculateRoyaltyAllocations.ts:348` | `calculateRoyaltyAllocations` | `onCall` | Not established | Not established |
| `functions/finance/ingestEarningsReport.ts:404` | `ingestEarningsReport` | `onCall` | Not established | Not established |
| `functions/finance/parseAndIngestReport.ts:23` | `parseAndIngestRoyaltyReport` | `onCall` | Not established | Not established |
| `functions/finance/requestTaxFormUpload.ts:58` | `requestTaxFormUpload` | `onCall` | Not established | Not established |
| `functions/finance/setRecoupmentBalance.ts:123` | `setRecoupmentBalance` | `onCall` | Not established | Not established |
| `functions/finance/submitTaxForm.ts:157` | `submitTaxForm` | `onRequest` | Not established | Not established |
| `functions/intelligence/typesafeJudge.ts:30` | `typesafeJudge` | `onCall` | Not established | Not established |
| `functions/knowledge/query.ts:29` | `queryKnowledgeBase` | `onCall` | Not established | Not established |
| `functions/knowledge/upload.ts:26` | `createKnowledgeUpload` | `onCall` | Not established | Not established |
| `functions/knowledge/upload.ts:97` | `finalizeKnowledgeUpload` | `onCall` | Not established | Not established |
| `functions/knowledge/upload.ts:207` | `deleteKnowledgeDocument` | `onCall` | Not established | Not established |
| `functions/marketing/adCampaignCallables.ts:218` | `executeUnifiedCampaignDirective` | `onCall` | Not established | Not established |
| `functions/marketing/adCampaignCallables.ts:258` | `ingestUnifiedAttributionEvent` | `onCall` | Not established | Not established |
| `functions/music/claimsInbox.ts:119` | `getCanonicalClaimsInbox` | `onCall` | Not established | Not established |
| `functions/music/claimsInbox.ts:124` | `declareCanonicalRightsClaim` | `onCall` | Not established | Not established |
| `functions/music/claimsInbox.ts:129` | `respondToCanonicalRightsClaim` | `onCall` | Not established | Not established |
| `functions/music/getCanonicalMusicCatalogIntelligence.ts:40` | `getCanonicalMusicCatalogIntelligence` | `onCall` | Not established | Not established |
| `functions/persona/recordPersonaResponseMeasurement.ts:104` | `recordPersonaResponseMeasurement` | `onCall` | Not established | Not established |
| `functions/print/enqueuePrintJob.ts:78` | `enqueuePrintJob` | `onCall` | Not established | Not established |
| `functions/print/preparePrintHandoff.ts:14` | `preparePrintHandoff` | `onCall` | Not established | Not established |
| `functions/remote/issueStudioExecutorLease.ts:31` | `issueStudioExecutorLease` | `onCall` | Not established | Not established |
| `functions/remote/issueStudioExecutorLease.ts:64` | `publishStudioPresence` | `onCall` | Not established | Not established |
| `functions/remote/issueStudioExecutorLease.ts:138` | `releaseStudioPresence` | `onCall` | Not established | Not established |
| `functions/remote/issueStudioExecutorLease.ts:153` | `claimStudioCommand` | `onCall` | Not established | Not established |
| `functions/remote/issueStudioExecutorLease.ts:175` | `publishStudioResponse` | `onCall` | Not established | Not established |
| `functions/remote/issueStudioExecutorLease.ts:201` | `completeStudioCommand` | `onCall` | Not established | Not established |
| `functions/rights/queueRightsRegistration.ts:166` | `queueRightsRegistration` | `onCall` | Not established | Not established |
| `functions/rights/rightsRegistration.ts:85` | `rightsRegistration` | `onCall` | Not established | Not established |
| `functions/security/claimComputerApproval.ts:23` | `claimComputerApproval` | `onCall` | Not established | Not established |
| `functions/security/claimComputerApproval.ts:45` | `denyComputerApproval` | `onCall` | Not established | Not established |
| `functions/security/errorReportCallables.ts:94` | `listErrorReports` | `onCall` | Not established | Not established |
| `functions/security/errorReportCallables.ts:124` | `updateErrorReportStatus` | `onCall` | Not established | Not established |
| `functions/security/logAuditEvent.ts:155` | `logAuditEvent` | `onCall` | Present | Not established |
| `functions/security/organizationAccess.ts:327` | `getOrganizationAccessMatrix` | `onCall` | Present | Not established |
| `functions/security/organizationAccess.ts:332` | `updateOrganizationMemberAccess` | `onCall` | Present | Not established |
| `functions/security/persistFraudAlert.ts:80` | `persistFraudAlert` | `onCall` | Present | Not established |
| `functions/security/writeSharedOperationalData.ts:64` | `registerAiContextCache` | `onCall` | Not established | Not established |
| `functions/security/writeSharedOperationalData.ts:109` | `recordInstrumentUsage` | `onCall` | Not established | Not established |
| `functions/social-connections.ts:23` | `getSocialConnectionStatus` | `onCall` | Not established | Not established |
| `functions/social-stats-sync.ts:346` | `syncPlatformStats` | `onCall` | Not established | Not established |
| `functions/storage/fetchStorageAssetForCanvas.ts:13` | `fetchStorageAssetForCanvas` | `onCall` | Not established | Not established |
| `functions/trash/trashFunctions.ts:143` | `createPurgeIntent` | `onCall` | Not established | Not established |
| `functions/trash/trashFunctions.ts:173` | `purgeTrashItems` | `onCall` | Not established | Not established |
| `functions/video/alignSessionMaster.ts:219` | `alignSessionMaster` | `onCall` | Present | Present |
| `functions/video/approveSessionEditPlan.ts:99` | `approveSessionEditPlan` | `onCall` | Present | Present |
| `functions/video/cancelVideoSession.ts:131` | `cancelVideoSession` | `onCall` | Present | Present |
| `functions/video/createVideoSession.ts:557` | `createVideoSession` | `onCall` | Present | Present |
| `functions/video/generateSessionEditPlan.ts:269` | `generateSessionEditPlan` | `onCall` | Present | Present |
| `functions/video/getVideoRenderReceipt.ts:211` | `getVideoRenderReceipt` | `onCall` | Present | Present |
| `functions/video/queueCloudVideoRender.ts:74` | `queueCloudVideoRender` | `onCall` | Present | Present |
| `functions/video/relayVideoRenderJob.ts:23` | `claimVideoRenderJob` | `onCall` | Present | Present |
| `functions/video/relayVideoRenderJob.ts:70` | `completeVideoRenderJob` | `onCall` | Present | Present |
| `functions/video/retrySessionProxyJob.ts:145` | `retrySessionProxyJob` | `onCall` | Present | Present |
| `functions/webhooks/dispatcher.ts:432` | `createWebhook` | `onRequest` | Not established | Not established |
| `index.ts:450` | `triggerVideoJob` | `onCall` | Present | Not established |
| `index.ts:655` | `triggerLongFormVideoJob` | `onCall` | Present | Not established |
| `index.ts:809` | `renderVideo` | `onCall` | Present | Present |
| `index.ts:1095` | `inngestApi` | `onRequest` | Not established | Not established |
| `index.ts:1164` | `generateContentStream` | `onRequest` | Present | Present |
| `index.ts:1598` | `ragProxy` | `onRequest` | Not established | Not established |
| `index.ts:1662` | `listGKEClusters` | `onCall` | Not established | Not established |
| `index.ts:1716` | `getGKEClusterStatus` | `onCall` | Not established | Not established |
| `index.ts:1744` | `scaleGKENodePool` | `onCall` | Not established | Not established |
| `index.ts:1772` | `listGCEInstances` | `onCall` | Not established | Not established |
| `index.ts:1799` | `restartGCEInstance` | `onCall` | Not established | Not established |
| `index.ts:1833` | `executeBigQueryQuery` | `onCall` | Not established | Not established |
| `index.ts:1869` | `getBigQueryTableSchema` | `onCall` | Not established | Not established |
| `index.ts:1897` | `listBigQueryDatasets` | `onCall` | Not established | Not established |
| `index.ts:1971` | `exportUserData` | `onCall` | Not established | Not established |
| `index.ts:2043` | `requestAccountDeletion` | `onCall` | Not established | Not established |
| `index.ts:2119` | `healthCheck` | `onRequest` | Not established | Not established |
| `index.ts:2155` | `healthCheckWest1` | `onRequest` | Not established | Not established |
| `index.ts:2175` | `enrichFanData` | `onCall` | Not established | Not established |
| `legal/digitalSignature.ts:7` | `sendForDigitalSignature` | `onCall` | Not established | Not established |
| `legal/exportSplitSheet.ts:202` | `exportSplitSheet` | `onCall` | Not established | Not established |
| `legal/mechanicalLicense.ts:29` | `verifyMechanicalLicense` | `onCall` | Not established | Not established |
| `legal/pandadocProxy.ts:60` | `pandadocListTemplates` | `onCall` | Not established | Not established |
| `legal/pandadocProxy.ts:97` | `pandadocCreateDocument` | `onCall` | Not established | Not established |
| `legal/pandadocProxy.ts:182` | `pandadocSendDocument` | `onCall` | Not established | Not established |
| `legal/pandadocProxy.ts:225` | `pandadocGetDocumentStatus` | `onCall` | Not established | Not established |
| `legal/pandadocProxy.ts:276` | `pandadocGetSigningLink` | `onCall` | Not established | Not established |
| `legal/pandadocWebhook.ts:47` | `pandadocWebhook` | `onRequest` | Not established | Not established |
| `lib/audio.ts:50` | `(factory/helper)` | `onCall` | Not established | Not established |
| `lib/image_generation.ts:868` | `(factory/helper)` | `onCall` | Present | Not established |
| `lib/image_generation.ts:928` | `(factory/helper)` | `onCall` | Present | Not established |
| `lib/marketing.ts:176` | `executeCampaign` | `onCall` | Not established | Not established |
| `lib/marketing.ts:358` | `dispatchSocialPost` | `onCall` | Not established | Not established |
| `lib/marketing.ts:422` | `createInfluencerBounty` | `onCall` | Not established | Not established |
| `lib/touring.ts:276` | `computeDistanceMatrix` | `onCall` | Not established | Not established |
| `lib/touring.ts:315` | `generateItinerary` | `onCall` | Not established | Not established |
| `lib/touring.ts:329` | `checkLogistics` | `onCall` | Not established | Not established |
| `lib/touring.ts:343` | `findPlaces` | `onCall` | Not established | Not established |
| `marketing/campaignMetricsCallable.ts:124` | `marketingGetCampaignMetrics` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:39` | `createAdCampaign` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:107` | `createAdSet` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:185` | `createAd` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:244` | `getAdInsights` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:289` | `pauseAdCampaign` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:324` | `getSocialPostInsights` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:366` | `syncEmailList` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:411` | `deployEmailCampaign` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:460` | `getEmailCampaignStats` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:502` | `sendSMSBlast` | `onCall` | Not established | Not established |
| `marketing/marketingCallables.ts:551` | `getSMSDeliveryStatus` | `onCall` | Not established | Not established |
| `marketing/presaveCampaigns.ts:230` | `createPreSaveCampaign` | `onCall` | Not established | Not established |
| `marketing/presaveCampaigns.ts:248` | `getPreSaveCampaign` | `onCall` | Present | Present |
| `marketing/presaveCampaigns.ts:304` | `listPreSaveCampaigns` | `onCall` | Present | Present |
| `marketing/presaveRegister.ts:180` | `presaveRegister` | `onCall` | Present | Present |
| `marketing/shopifyWebhook.ts:188` | `shopifyWebhook` | `onRequest` | Not established | Not established |
| `marketing/smartLink.ts:103` | `smartLinkRedirect` | `onRequest` | Not established | Not established |
| `marketplace/createMarketplaceCheckout.ts:38` | `createMarketplaceCheckout` | `onCall` | Not established | Not established |
| `marketplace/getStemDownloadUrl.ts:24` | `getStemDownloadUrl` | `onCall` | Not established | Not established |
| `mcp/index.ts:159` | `mcpEndpoint` | `onRequest` | Not established | Not established |
| `pod/checkout.ts:107` | `pod_createOrderCheckout` | `onCall` | Not established | Not established |
| `pod/printful.ts:13` | `pod_printfulGetProducts` | `onCall` | Not established | Not established |
| `pod/printful.ts:18` | `pod_printfulGetProduct` | `onCall` | Not established | Not established |
| `pod/printful.ts:23` | `pod_printfulCalculatePrice` | `onCall` | Not established | Not established |
| `pod/printful.ts:37` | `pod_printfulGetShippingRates` | `onCall` | Not established | Not established |
| `pod/printful.ts:57` | `pod_printfulCreateOrder` | `onCall` | Not established | Not established |
| `pod/printful.ts:115` | `pod_printfulGetOrder` | `onCall` | Not established | Not established |
| `pod/printful.ts:121` | `pod_printfulCancelOrder` | `onCall` | Not established | Not established |
| `pod/printful.ts:132` | `pod_printfulGenerateMockup` | `onCall` | Not established | Not established |
| `releases/generateDownloadUrl.ts:5` | `generateReleaseDownloadUrl` | `onCall` | Not established | Not established |
| `social/instagramMessaging.ts:52` | `sendInstagramMessageCallable` | `onCall` | Present | Not established |
| `social/instagramMessaging.ts:127` | `replyInstagramCommentCallable` | `onCall` | Present | Not established |
| `social/instagramMessaging.ts:181` | `getInstagramMediaCommentsCallable` | `onCall` | Present | Not established |
| `social/instagramWebhook.ts:26` | `instagramWebhook` | `onRequest` | Not established | Not established |
| `streaming/agentStream.ts:73` | `agentStreamResponse` | `onRequest` | Not established | Not established |
| `streaming/agentStream.ts:221` | `agentStreamHealth` | `onRequest` | Not established | Not established |
| `stripe/connect.ts:8` | `createStripeConnectAccount` | `onCall` | Not established | Not established |
| `stripe/connect.ts:73` | `createTransfer` | `onCall` | Not established | Not established |
| `stripe/escrow.ts:15` | `handleEscrowWebhook` | `onRequest` | Not established | Not established |
| `stripe/paymentLinks.ts:223` | `createStripePaymentLinks` | `onCall` | Not established | Not established |
| `stripe/splitEscrow.ts:38` | `initiateSplitEscrow` | `onCall` | Not established | Not established |
| `stripe/splitEscrow.ts:183` | `signEscrow` | `onCall` | Not established | Not established |
| `stripe/splitEscrow.ts:249` | `releaseEscrow` | `onCall` | Not established | Not established |
| `stripe/taxForms.ts:10` | `requestTaxForms` | `onCall` | Not established | Not established |
| `stripe/webhookHandler.ts:1269` | `stripeWebhook` | `onRequest` | Not established | Not established |
| `subscription/activateFounderPass.ts:203` | `activateFounderPass` | `onCall` | Not established | Not established |
| `subscription/cancelSubscription.ts:13` | `cancelSubscription` | `onCall` | Not established | Not established |
| `subscription/createCheckoutSession.ts:16` | `createCheckoutSession` | `onCall` | Not established | Not established |
| `subscription/createMicroTransaction.ts:7` | `createMicroTransaction` | `onCall` | Not established | Not established |
| `subscription/createOneTimeCheckout.ts:30` | `createOneTimeCheckout` | `onCall` | Not established | Not established |
| `subscription/deductCredits.ts:19` | `deductCredits` | `onCall` | Not established | Not established |
| `subscription/generateInvoice.ts:40` | `generateInvoice` | `onCall` | Not established | Not established |
| `subscription/getCustomerPortal.ts:13` | `getCustomerPortal` | `onCall` | Not established | Not established |
| `subscription/getSubscription.ts:5` | `getSubscription` | `onCall` | Not established | Not established |
| `subscription/getUsageStats.ts:15` | `getUsageStats` | `onCall` | Not established | Not established |
| `subscription/resumeSubscription.ts:13` | `resumeSubscription` | `onCall` | Not established | Not established |
| `subscription/trackUsage.ts:12` | `trackUsage` | `onCall` | Not established | Not established |
| `subscription/updateWalletSettings.ts:26` | `updateWalletSettings` | `onCall` | Not established | Not established |
