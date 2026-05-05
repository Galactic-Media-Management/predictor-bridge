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
| Predictor Bridge (resettable) | Sepolia | Testnet | TBD — paste after first deploy |

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


## External Contract Dependencies
- Chainlink USDC/ETH Feed\
`CHAINLINK_USDC_ETH_FEED`: [0x986b5E1e1755e3C2440e960477f25201B0a8bbD4](https://etherscan.io/address/0x986b5E1e1755e3C2440e960477f25201B0a8bbD4)

- Uniswap V3 USDC/WETH Pool\
`UNISWAP_V3_USDC_WETH_POOL`: [0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640](https://etherscan.io/address/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640)

- Chainalysis Sanctions\
`CHAINALYSIS_SANCTIONS`: [0x40C57923924B5c5c5455c48D93317139ADDaC8fb](https://etherscan.io/address/0x40C57923924B5c5c5455c48D93317139ADDaC8fb)

- Tokens  
  - `USDC`: [0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
  - `USDT`: [0xdAC17F958D2ee523a2206206994597C13D831ec7](https://etherscan.io/address/0xdAC17F958D2ee523a2206206994597C13D831ec7)
  - `WETH`: [0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2](https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2)

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

## Resettable Variant (Sepolia only)
`PredictorBridgeResettable` is a subclass of the production bridge that adds a single owner-gated `reset(...)` function for clearing per-run state between test runs. Production behaviour is inherited unchanged.

`reset(...)` clears the author set internally (the contract knows every authorId it issued) and accepts caller-supplied keys for sparse maps that have no on-chain enumeration: used lower ids, used T2 tx ids, published root hashes, and relayer addresses. It then re-seeds the author set in the same transaction. The owner is preserved across resets. Each reset bumps `resetNonce` and emits `LogReset(nonce)`.

### Deploy
`npm run deploy:bridge:testnet:resettable`

The script reuses `deploy/deploy-bridge.js` with `BRIDGE_CONTRACT=PredictorBridgeResettable`. The deployed proxy address is permanent — paste it into the contracts table above after the first deploy.

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