// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import './PredictorBridge.sol';

/**
 * @dev Testnet-only variant of PredictorBridge that adds an owner-gated reset() to wipe per-run state
 * and re-seed the author set in a single transaction. Production behaviour is inherited unchanged.
 */
contract PredictorBridgeResettable is PredictorBridge {
  event LogReset(uint32 indexed nonce);

  uint32 public resetNonce;

  constructor(address feed, address pool, address sanctions, address usdc, address usdt, address weth)
    PredictorBridge(feed, pool, sanctions, usdc, usdt, weth)
  {}

  /**
   * @dev Wipes per-run bridge state and re-seeds the author set.
   *
   * Author state (bitmaps + four mappings + counters) is cleared internally — the contract knows
   * every authorId it has issued via nextAuthorId. Sparse maps without a counter (used lowers,
   * used T2 tx ids, published roots, relayer balances) cannot be enumerated, so the caller passes
   * the keys it created during the run.
   *
   * Owner is preserved across resets.
   *
   * @param lowerIds Lower ids to clear from usedLowers.
   * @param t2TxIds T2 transaction ids to clear from usedT2TxIds.
   * @param rootHashes Published root hashes to clear.
   * @param relayers Relayer addresses to clear (does not refund any USDC balance).
   * @param t1Addresses Initial author T1 addresses for the next run.
   * @param t1PubKeysLHS Left-hand 32 bytes of each uncompressed T1 public key.
   * @param t1PubKeysRHS Right-hand 32 bytes of each uncompressed T1 public key.
   * @param t2PubKeys Initial author T2 public keys for the next run.
   */
  function reset(
    uint32[] calldata lowerIds,
    uint32[] calldata t2TxIds,
    bytes32[] calldata rootHashes,
    address[] calldata relayers,
    address[] calldata t1Addresses,
    bytes32[] calldata t1PubKeysLHS,
    bytes32[] calldata t1PubKeysRHS,
    bytes32[] calldata t2PubKeys
  ) external onlyOwner {
    uint256 next = nextAuthorId;
    for (uint256 id = 1; id < next; ++id) {
      delete t1AddressToId[idToT1Address[id]];
      delete t2PubKeyToId[idToT2PubKey[id]];
      delete idToT1Address[id];
      delete idToT2PubKey[id];
    }
    isAuthorBitmap = 0;
    authorIsActiveBitmap = 0;
    numActiveAuthors = 0;
    nextAuthorId = 1;

    for (uint256 i; i < lowerIds.length; ++i) {
      (uint256 bucket, uint256 mask) = _idToBitmap(lowerIds[i]);
      usedLowers[bucket] &= ~mask;
    }
    for (uint256 i; i < t2TxIds.length; ++i) {
      (uint256 bucket, uint256 mask) = _idToBitmap(t2TxIds[i]);
      usedT2TxIds[bucket] &= ~mask;
    }
    for (uint256 i; i < rootHashes.length; ++i) delete isPublishedRootHash[rootHashes[i]];
    for (uint256 i; i < relayers.length; ++i) delete relayerBalance[relayers[i]];

    _initialiseAuthors(t1Addresses, t1PubKeysLHS, t1PubKeysRHS, t2PubKeys);

    emit LogReset(++resetNonce);
  }
}
