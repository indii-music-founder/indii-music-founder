# Smart-Contract Splitter & Fractionalized Capital Flowchart

This flowchart outlines the integration of Web3 smart contracts within the `indii` ecosystem. It demonstrates how traditional DSP off-chain data bridges to on-chain environments via oracles to execute automated royalty splits in stablecoins.

```mermaid
graph TD
    %% Frontend Config
    SliderUI["Adjust Split Sliders (UI)"] --> Store["Zustand: useFinanceStore()"]
    Store --> DeployBtn["Click 'Deploy Split Contract'"]
    
    %% Contract Deployment
    DeployBtn --> Web3Service["Web3Service (Ethers.js / Viem)"]
    Web3Service --> Chain["Avalanche / Solana Network"]
    Chain -- "Returns Contract Address" --> Firestore["Firestore: contracts/{contractId}"]
    
    %% The Oracle Payout Loop
    Distro["DSP Aggregator / Distributor"] -- "Issues Payout Report" --> OracleNode["Chainlink Oracle Node (Off-chain)"]
    OracleNode -- "Verifies & Pushes Data" --> SmartContract["Deployed Smart Contract (On-chain)"]
    
    %% Execution
    SmartContract --> ExecuteSplit{"Execute Fractional Splits"}
    ExecuteSplit -- "60% Artist" --> ArtistWallet["Artist Wallet (USDC)"]
    ExecuteSplit -- "30% Producer" --> ProdWallet["Producer Wallet (USDC)"]
    ExecuteSplit -- "10% Superfan Pool" --> FanWallet["Fractionalized Fan Pool (USDC)"]
    
    %% Styling Classes
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#000
    classDef state fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#000
    classDef db fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef api fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef crypto fill:#e1bee7,stroke:#6a1b9a,stroke-width:2px,color:#000
    
    class SliderUI,DeployBtn ui
    class Store,Web3Service state
    class Firestore db
    class Distro,OracleNode api
    class Chain,SmartContract,ExecuteSplit,ArtistWallet,ProdWallet,FanWallet crypto
```

## Transition Breakdown
1. **Configuration:** The artist sets visual splits in the React UI (e.g., 60% Artist, 30% Producer, 10% Fan Investor Pool). The Zustand store holds this configuration.
2. **Deployment:** The `Web3Service` compiles this data into a standard smart contract template and deploys it to a fast, low-fee chain (like Avalanche). The resulting contract address is saved in Firestore.
3. **The Oracle Bridge:** Because blockchains cannot directly read Spotify play counts, a Chainlink Oracle node acts as the bridge. When a traditional distributor (like TuneCore) issues a revenue statement, the Oracle verifies the data and pushes it to the smart contract.
4. **Execution:** Upon receiving verified payout data (and the corresponding capital transfer), the smart contract automatically executes the programmed splits, depositing USDC directly into the respective collaborator and fan wallets instantly.
