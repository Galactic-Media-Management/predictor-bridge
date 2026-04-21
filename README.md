# Predictor Bridge
Upgradeable Ethereum bridge contract for moving ERC-20 assets between Ethereum and Predictor Network.

The bridge is secured by a threshold of Predictor Network authors, who collectively:
- approve author set changes
- publish transaction checkpoints as Merkle roots
- authorise token releases back to Ethereum

The contract supports standard ERC-20 bridging, permit-based lifts, and sponsored USDC bridge actions via relayers.

## Contracts
| Contract | Network | Environment | Address |
|---|---|---:|---|
| Predictor Bridge | Mainnet | Production | TBD |
| Predictor Bridge | Sepolia | Testnet | TBD |
| Predictor Bridge | Sepolia | Dev | TBD |

## Bridge overview
The bridge operates in two directions:

- **Lift**: tokens are transferred into the bridge on Ethereum and represented on Predictor Network for the chosen T2 recipient.
- **Lower**: proof of token burn on Predictor Network is supplied to the bridge, which then releases the corresponding tokens on Ethereum.

## Features
- Upgradeable UUPS bridge deployed behind an `ERC1967Proxy`
- Author-managed security model with threshold confirmations
- Author addition, activation, and removal by consensus
- Merkle root publication by consensus
- ERC-20 lifts and lowers between Ethereum and Predictor Network
- Permit-based lifting for tokens supporting ERC-2612
- Sponsored USDC lifts and lowers through registered relayers
- Chainalysis sanctions checks on supported user entrypoints

## Lift methods
| Method                          | User TX Required | Caller  | Allowed Tokens     | Destination Account Format  | Account Type      |
|---------------------------------|:----------------:|:-------:|--------------------|-----------------------------|-------------------|
| `lift`                          | 2                | User    | Any ERC20          | Explicit `bytes32`          | Base account      |
| `permitLift`                    | 1                | User    | Any EIP-2612 ERC20 | Explicit `bytes32`          | Base account      |
| `predictionMarketLift`          | 2                | User    | USDC / USDT        | Derived from caller address | Prediction market |
| `predictionMarketPermitLift`    | 1                | User    | USDC               | Derived from caller address | Prediction market |
| `predictionMarketRecipientLift` | 2                | User    | USDC / USDT        | Explicit `bytes32`          | Prediction market |
| `relayerLift`                   | 0                | Relayer | USDC               | Derived from user address   | Prediction market |

## Development

### Setup
`npm i`

#### Unit Tests
`npm run test`

#### Test Coverage
`npm run coverage`

#### Gas Report
`npm run gas`

## Initial Deployment
Deploys the persistent proxy contract and its initial implementation contract.

### Prerequisites
- Ensure `bridge.config.js` is populated correctly for the target environment
- Create a `.env` file with the following values completed:

ETHERSCAN_API_KEY=  
SEPOLIA_RPC_URL=  
SEPOLIA_PRIVATE_KEY=  
MAINNET_RPC_URL=  
MAINNET_LEDGER_ADDRESS=  

### Commands
npm run deploy:bridge:dev
npm run deploy:bridge:testnet
npm run deploy:bridge:mainnet

### Result
- Persistent proxy deployed and verified on Etherscan
- Storage initialised with authors specified in `bridge.config.js`
- Bridge implementation deployed and verified on Etherscan
- Implementation configured with owner wallet and contract addresses specified in `bridge.config.js`

## Upgrading
Deploys a new implementation contract to upgrade the proxy to.

### Prerequisites
Ensure the new implementation is upgrade-safe:
- Storage layout is strictly append-only (no reordering, removal, or type changes)
- No constructor logic relied upon (only immutables are allowed)
- Initializer/reinitializer usage is correct (no accidental re-initialisation)
- Inheritance order remains consistent
- `UUPSUpgradeable` is still correctly implemented with `_authorizeUpgrade`

### Commands
npm run deploy:implementation:dev
npm run deploy:implementation:testnet
npm run deploy:implementation:mainnet

### Result
- New bridge implementation deployed and verified on Etherscan
- Implementation configured with owner wallet and contract addresses specified in `bridge.config.js`
- New implementation address emitted for owner to pass to `upgradeToAndCall` on the proxy