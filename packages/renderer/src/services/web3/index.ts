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
