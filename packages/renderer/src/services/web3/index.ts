/**
 * Web3 Services — Barrel Export
 *
 * Items 236-240: Blockchain, IPFS, NFT marketplace, and name resolution.
 */

export { walletConnectService, WalletConnectService } from './WalletConnectService';
export type { WalletInfo, WalletConnectConfig } from './WalletConnectService';

export { ethereumService, EthereumService } from './EthereumService';
export type { ContractConfig, TransactionResult, TokenMetadata } from './EthereumService';

export { pinataService, PinataService } from './PinataService';
export type { PinResult, PinnedItem, PinataOptions } from './PinataService';

export { openSeaService, OpenSeaService } from './OpenSeaService';
export type { NFTListing, NFTCollection, ListingParams } from './OpenSeaService';

export { nameResolutionService, NameResolutionService } from './NameResolutionService';
export type { ResolvedName } from './NameResolutionService';

// Consolidated from the former services/blockchain/ directory (redundancy audit 2026):
// SmartContractService (ERC-721/1155 royalty splits + chain-of-custody) and
// IPFSPinataService (release-focused IPFS pinning). Its duplicate OpenSea and ENS
// services were deleted — web3/OpenSeaService + web3/NameResolutionService are canonical.
// Note: IPFSPinataService's own `PinResult` type is intentionally not re-exported here
// (name collision with PinataService's); import it from './IPFSPinataService' directly.
export { smartContractService, SmartContractService } from './SmartContractService';
export type { SplitContractConfig, LedgerEntry } from './SmartContractService';

export { ipfsPinataService, IPFSPinataService } from './IPFSPinataService';
export type { ReleaseMetadataPin } from './IPFSPinataService';
