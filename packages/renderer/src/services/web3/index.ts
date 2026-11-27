/**
 * Web3 Services — Barrel Export
 *
 * Items 236-240: Blockchain, IPFS, NFT marketplace, and name resolution.
 */

export { walletConnectService, WalletConnectService } from '@/services/web3/WalletConnectService';
export type { WalletInfo, WalletConnectConfig } from '@/services/web3/WalletConnectService';

export { ethereumService, EthereumService } from '@/services/web3/EthereumService';
export type { ContractConfig, TransactionResult, TokenMetadata } from '@/services/web3/EthereumService';

export { pinataService, PinataService } from '@/services/web3/PinataService';
export type { PinResult, PinnedItem, PinataOptions } from '@/services/web3/PinataService';

export { openSeaService, OpenSeaService } from '@/services/web3/OpenSeaService';
export type { NFTListing, NFTCollection, ListingParams } from '@/services/web3/OpenSeaService';

export { nameResolutionService, NameResolutionService } from '@/services/web3/NameResolutionService';
export type { ResolvedName } from '@/services/web3/NameResolutionService';

// Consolidated from the former services/blockchain/ directory (redundancy audit 2026):
// SmartContractService (ERC-721/1155 royalty splits + chain-of-custody) and
// IPFSPinataService (release-focused IPFS pinning). Its duplicate OpenSea and ENS
// services were deleted — web3/OpenSeaService + web3/NameResolutionService are canonical.
// Note: IPFSPinataService's own `PinResult` type is intentionally not re-exported here
// (name collision with PinataService's); import it from './IPFSPinataService' directly.
export { smartContractService, SmartContractService } from '@/services/web3/SmartContractService';
export type { SplitContractConfig, LedgerEntry } from '@/services/web3/SmartContractService';

export { ipfsPinataService, IPFSPinataService } from '@/services/web3/IPFSPinataService';
export type { ReleaseMetadataPin } from '@/services/web3/IPFSPinataService';
