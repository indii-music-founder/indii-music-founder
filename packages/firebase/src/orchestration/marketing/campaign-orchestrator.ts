/**
 * CampaignOrchestrator — Layer 2 (Orchestration)
 *
 * Cross-department coordinator linking:
 * 1. Directive Layer: Growth Intelligence Engine & Marketing Agent directives
 *    (`UnifiedCampaignDirective`).
 * 2. Asset Verification: Confirms post-mastering release IDs, ISRCs, and
 *    visual/video asset references exist and are approved for external paid
 *    amplification.
 * 3. Finance Department Recoupment Ledger: Verifies available budget on
 *    `ledgerAccountId`, reserves the exact allocated cents before provisioning,
 *    and records recouped/committed spend per platform receipt.
 * 4. Execution Layer: Dispatches deterministic `provisionCampaign`,
 *    `updateBudget`, `updateStatus`, and `fetchTelemetry` calls across
 *    registered `IAdPlatformAdapter` instances (`META`, `TIKTOK`, `GOOGLE_ADS`).
 */

import {
    type IAdPlatformAdapter,
    type PlatformCampaignReceipt,
    type PlatformTelemetrySnapshot,
    type SupportedAdPlatform,
    type UnifiedCampaignDirective,
    type VerifiedReleaseAssets,
    UnifiedCampaignDirectiveSchema,
} from '../../types/ad-execution.types';
import {
    type CampaignAllocationJudgment,
} from './campaign-judgments';

export type ICampaignAllocationJudgePort = (
    directive: UnifiedCampaignDirective,
    priorTelemetry?: ReadonlyArray<PlatformTelemetrySnapshot>,
) => Promise<CampaignAllocationJudgment>;

export interface FinanceRecoupmentLedgerEntry {
    reservationId: string;
    directiveId: string;
    artistId: string;
    ledgerAccountId: string;
    releaseId: string;
    isrc: string;
    currency: string;
    reservedCents: number;
    committedCents: number;
    status: 'RESERVED' | 'COMMITTED' | 'RELEASED';
    createdAtIso: string;
    updatedAtIso: string;
}

export interface IFinanceRecoupmentLedgerPort {
    reserveCampaignBudget(input: {
        directiveId: string;
        artistId: string;
        ledgerAccountId: string;
        releaseId: string;
        isrc: string;
        currency: string;
        amountCents: number;
    }): Promise<FinanceRecoupmentLedgerEntry>;

    commitCampaignBudget(
        reservationId: string,
        committedCents: number,
        receipts: ReadonlyArray<PlatformCampaignReceipt>,
    ): Promise<FinanceRecoupmentLedgerEntry>;

    releaseCampaignBudget(reservationId: string, reason: string): Promise<void>;
}

export interface IPostMasteringAssetVerifierPort {
    verifyReleaseAssets(
        artistId: string,
        assets: VerifiedReleaseAssets,
    ): Promise<{ verified: boolean; reason?: string }>;
}

export interface OrchestratedCampaignExecutionResult {
    directiveId: string;
    artistId: string;
    ledgerAccountId: string;
    ledgerReservationId: string;
    allocatedPlatformBudgetsCents: Partial<Record<SupportedAdPlatform, number>>;
    totalCommittedBudgetCents: number;
    receipts: PlatformCampaignReceipt[];
    failures: Array<{
        platform: SupportedAdPlatform;
        allocatedBudgetCents: number;
        errorMessage: string;
    }>;
    allocationJudgment?: CampaignAllocationJudgment;
    executedAtIso: string;
}

export class InMemoryFinanceRecoupmentLedger implements IFinanceRecoupmentLedgerPort {
    private readonly balancesCents = new Map<string, number>();
    private readonly entries = new Map<string, FinanceRecoupmentLedgerEntry>();

    constructor(initialBalancesCents: Record<string, number> = {}) {
        for (const [accountId, balance] of Object.entries(initialBalancesCents)) {
            this.balancesCents.set(accountId, balance);
        }
    }

    setAccountBalance(ledgerAccountId: string, balanceCents: number): void {
        this.balancesCents.set(ledgerAccountId, balanceCents);
    }

    getAccountBalance(ledgerAccountId: string): number {
        return this.balancesCents.get(ledgerAccountId) ?? 0;
    }

    getEntry(reservationId: string): FinanceRecoupmentLedgerEntry | undefined {
        return this.entries.get(reservationId);
    }

    async reserveCampaignBudget(input: {
        directiveId: string;
        artistId: string;
        ledgerAccountId: string;
        releaseId: string;
        isrc: string;
        currency: string;
        amountCents: number;
    }): Promise<FinanceRecoupmentLedgerEntry> {
        const available = this.balancesCents.get(input.ledgerAccountId) ?? 0;
        if (available < input.amountCents) {
            throw new Error(
                `Insufficient recoupment ledger balance on ${input.ledgerAccountId}: requested ${input.amountCents} cents, available ${available} cents.`,
            );
        }

        this.balancesCents.set(input.ledgerAccountId, available - input.amountCents);
        const now = new Date().toISOString();
        const reservationId = `res_${input.directiveId}_${input.ledgerAccountId}`;
        const entry: FinanceRecoupmentLedgerEntry = {
            reservationId,
            directiveId: input.directiveId,
            artistId: input.artistId,
            ledgerAccountId: input.ledgerAccountId,
            releaseId: input.releaseId,
            isrc: input.isrc,
            currency: input.currency,
            reservedCents: input.amountCents,
            committedCents: 0,
            status: 'RESERVED',
            createdAtIso: now,
            updatedAtIso: now,
        };
        this.entries.set(reservationId, entry);
        return entry;
    }

    async commitCampaignBudget(
        reservationId: string,
        committedCents: number,
    ): Promise<FinanceRecoupmentLedgerEntry> {
        const entry = this.entries.get(reservationId);
        if (!entry) {
            throw new Error(`Ledger reservation ${reservationId} not found.`);
        }

        const unspentCents = Math.max(0, entry.reservedCents - committedCents);
        if (unspentCents > 0) {
            const current = this.balancesCents.get(entry.ledgerAccountId) ?? 0;
            this.balancesCents.set(entry.ledgerAccountId, current + unspentCents);
        }

        const updated: FinanceRecoupmentLedgerEntry = {
            ...entry,
            committedCents,
            status: committedCents > 0 ? 'COMMITTED' : 'RELEASED',
            updatedAtIso: new Date().toISOString(),
        };
        this.entries.set(reservationId, updated);
        return updated;
    }

    async releaseCampaignBudget(reservationId: string): Promise<void> {
        const entry = this.entries.get(reservationId);
        if (!entry || entry.status === 'RELEASED') return;

        const refund = Math.max(0, entry.reservedCents - entry.committedCents);
        const current = this.balancesCents.get(entry.ledgerAccountId) ?? 0;
        this.balancesCents.set(entry.ledgerAccountId, current + refund);

        this.entries.set(reservationId, {
            ...entry,
            status: 'RELEASED',
            updatedAtIso: new Date().toISOString(),
        });
    }
}

export class DefaultPostMasteringAssetVerifier implements IPostMasteringAssetVerifierPort {
    async verifyReleaseAssets(
        _artistId: string,
        assets: VerifiedReleaseAssets,
    ): Promise<{ verified: boolean; reason?: string }> {
        if (!assets.releaseId.trim() || !assets.isrc.trim() || !assets.smartlinkId.trim()) {
            return {
                verified: false,
                reason: 'Missing mandatory post-mastering releaseId, ISRC, or smartlinkId.',
            };
        }
        return { verified: true };
    }
}

export class CampaignOrchestrator {
    private readonly adapters = new Map<SupportedAdPlatform, IAdPlatformAdapter>();
    private readonly financeLedger: IFinanceRecoupmentLedgerPort;
    private readonly assetVerifier: IPostMasteringAssetVerifierPort;
    private readonly campaignJudge?: ICampaignAllocationJudgePort;

    constructor(options: {
        adapters: ReadonlyArray<IAdPlatformAdapter>;
        financeLedger: IFinanceRecoupmentLedgerPort;
        assetVerifier?: IPostMasteringAssetVerifierPort;
        campaignJudge?: ICampaignAllocationJudgePort;
    }) {
        for (const adapter of options.adapters) {
            this.adapters.set(adapter.platform, adapter);
        }
        this.financeLedger = options.financeLedger;
        this.assetVerifier = options.assetVerifier ?? new DefaultPostMasteringAssetVerifier();
        this.campaignJudge = options.campaignJudge;
    }

    /**
     * Computes integer cent allocations across all requested platforms from
     * `platformSplitPercentages`. Validates that split percentages across target
     * platforms sum to 100% (within 0.01 tolerance) and assigns any 1-cent
     * rounding remainder deterministically to the first target platform so
     * total allocated cents equals `totalBudgetCents` exactly.
     */
    static computePlatformAllocationsCents(
        directive: UnifiedCampaignDirective,
    ): Record<SupportedAdPlatform, number> {
        const { platforms, budgetAllocation } = directive;
        const { totalBudgetCents, platformSplitPercentages } = budgetAllocation;

        let percentageSum = 0;
        for (const platform of platforms) {
            const pct = platformSplitPercentages[platform];
            if (typeof pct !== 'number' || pct <= 0) {
                throw new Error(
                    `Missing or non-positive split percentage for requested platform ${platform}.`,
                );
            }
            percentageSum += pct;
        }

        if (Math.abs(percentageSum - 100) > 0.01) {
            throw new Error(
                `Platform split percentages across [${platforms.join(', ')}] must sum to 100 (received ${percentageSum}).`,
            );
        }

        const allocations = {} as Record<SupportedAdPlatform, number>;
        let allocatedSum = 0;

        for (const platform of platforms) {
            const pct = platformSplitPercentages[platform]!;
            const share = Math.floor((totalBudgetCents * pct) / 100);
            allocations[platform] = share;
            allocatedSum += share;
        }

        const remainder = totalBudgetCents - allocatedSum;
        if (remainder > 0 && platforms.length > 0) {
            const primaryPlatform = platforms[0]!;
            allocations[primaryPlatform] = (allocations[primaryPlatform] ?? 0) + remainder;
        }

        return allocations;
    }

    /**
     * Executes a `UnifiedCampaignDirective` end-to-end across asset verification,
     * optional Jev System One allocation refinement, Finance recoupment ledger
     * reservation, multi-platform campaign provisioning, and final ledger commitment.
     */
    async executeDirective(
        rawDirective: UnifiedCampaignDirective,
        options?: { priorTelemetry?: ReadonlyArray<PlatformTelemetrySnapshot> },
    ): Promise<OrchestratedCampaignExecutionResult> {
        let directive = UnifiedCampaignDirectiveSchema.parse(rawDirective);

        // 1. Verify all requested platform adapters are registered
        for (const platform of directive.platforms) {
            if (!this.adapters.has(platform)) {
                throw new Error(
                    `No IAdPlatformAdapter registered for target platform ${platform}.`,
                );
            }
        }

        // 2. Verify post-mastering release assets & ISRC
        const assetCheck = await this.assetVerifier.verifyReleaseAssets(
            directive.artistId,
            directive.assets,
        );
        if (!assetCheck.verified) {
            throw new Error(
                `Post-mastering asset verification failed: ${assetCheck.reason ?? 'unverified release assets'}`,
            );
        }

        // 3. Optional Jev System One allocation refinement (for automated / agent directives)
        let allocationJudgment: CampaignAllocationJudgment | undefined;
        if (this.campaignJudge && directive.triggeredBy !== 'MANUAL_OVERRIDE') {
            allocationJudgment = await this.campaignJudge(directive, options?.priorTelemetry);
            if (!allocationJudgment.creativeReadinessConfirmed) {
                throw new Error(
                    'Jev System One creative readiness check rejected campaign execution due to insufficient platform-native assets.',
                );
            }
            directive = {
                ...directive,
                budgetAllocation: {
                    ...directive.budgetAllocation,
                    platformSplitPercentages: allocationJudgment.refinedSplitPercentages,
                },
            };
        }

        // 4. Calculate exact cent allocations per platform
        const allocations = CampaignOrchestrator.computePlatformAllocationsCents(directive);

        // 5. Reserve budget in Finance Department Recoupment Ledger
        const reservation = await this.financeLedger.reserveCampaignBudget({
            directiveId: directive.directiveId,
            artistId: directive.artistId,
            ledgerAccountId: directive.ledgerAccountId,
            releaseId: directive.assets.releaseId,
            isrc: directive.assets.isrc,
            currency: directive.budgetAllocation.currency,
            amountCents: directive.budgetAllocation.totalBudgetCents,
        });

        const receipts: PlatformCampaignReceipt[] = [];
        const failures: OrchestratedCampaignExecutionResult['failures'] = [];

        // 6. Provision campaigns across each target platform adapter
        for (const platform of directive.platforms) {
            const adapter = this.adapters.get(platform)!;
            const platformBudgetCents = allocations[platform];

            try {
                const receipt = await adapter.provisionCampaign(directive, platformBudgetCents);
                receipts.push(receipt);
            } catch (err) {
                failures.push({
                    platform,
                    allocatedBudgetCents: platformBudgetCents,
                    errorMessage: err instanceof Error ? err.message : String(err),
                });
            }
        }

        const totalCommittedBudgetCents = receipts.reduce(
            (sum, r) => sum + r.committedBudgetCents,
            0,
        );

        // 7. Commit actual provisioned budget to Finance ledger (auto-releasing any unspent portion)
        if (totalCommittedBudgetCents > 0) {
            await this.financeLedger.commitCampaignBudget(
                reservation.reservationId,
                totalCommittedBudgetCents,
                receipts,
            );
        } else {
            await this.financeLedger.releaseCampaignBudget(
                reservation.reservationId,
                'All platform provisioning calls failed.',
            );
        }

        return {
            directiveId: directive.directiveId,
            artistId: directive.artistId,
            ledgerAccountId: directive.ledgerAccountId,
            ledgerReservationId: reservation.reservationId,
            allocatedPlatformBudgetsCents: allocations,
            totalCommittedBudgetCents,
            receipts,
            failures,
            ...(allocationJudgment ? { allocationJudgment } : {}),
            executedAtIso: new Date().toISOString(),
        };
    }

    /**
     * Collects normalized telemetry across multiple provisioned campaign receipts
     * and computes cross-platform aggregate efficiency metrics.
     */
    async syncMultiPlatformTelemetry(
        receipts: ReadonlyArray<Pick<PlatformCampaignReceipt, 'platform' | 'externalCampaignId'>>,
        dateRange: { start: string; end: string },
    ): Promise<PlatformTelemetrySnapshot[]> {
        return Promise.all(
            receipts.map(async ({ platform, externalCampaignId }) => {
                const adapter = this.adapters.get(platform);
                if (!adapter) {
                    throw new Error(`No adapter registered for platform ${platform}.`);
                }
                return adapter.fetchTelemetry(externalCampaignId, dateRange);
            }),
        );
    }
}
