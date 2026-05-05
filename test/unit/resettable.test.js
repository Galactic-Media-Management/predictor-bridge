import {
  createLowerProof,
  createTreeAndPublishRoot,
  deployFixture,
  expect,
  getAccounts,
  getAuthors,
  getEthers,
  init,
  toAuthorAccount
} from '../helper.js';

describe('PredictorBridgeResettable', function () {
  let ethers;
  let owner;
  let user;
  let relayer;
  let bridge;
  let token;
  let usdc;
  let originalAuthors;

  beforeEach(async () => {
    await init({ numAuthors: 6 });
    ethers = getEthers();
    [owner, user, relayer] = getAccounts();
    originalAuthors = getAuthors().slice(0, 5);
    ({ bridge, token, usdc } = await deployFixture({ numAuthors: 5, contractName: 'PredictorBridgeResettable' }));
  });

  it('clears bridge state and re-seeds author set in one transaction', async () => {
    const amount = 100n;

    await token.approve(bridge.target, amount);
    await bridge.lift(token.target, await bridge.deriveT2PublicKey(owner.address), amount);

    const merkleTree = await createTreeAndPublishRoot(bridge, token.target, amount, owner.address);
    const lastPublishedTxId = 1;

    const [lowerProof, lowerId] = await createLowerProof(bridge, token, amount, user);
    await bridge.claimLower(lowerProof);

    await bridge.registerRelayer(relayer.address);

    expect(await bridge.isPublishedRootHash(merkleTree.rootHash)).to.equal(true);
    expect(await bridge.isUsedLower(lowerId)).to.equal(true);
    expect(await bridge.relayerBalance(relayer.address)).to.equal(1);
    expect(await bridge.numActiveAuthors()).to.equal(5n);
    expect(await bridge.t1AddressToId(originalAuthors[0].t1Address)).to.not.equal(0);
    expect(await bridge.corroborate(lastPublishedTxId, 0)).to.equal(1);
    expect(await bridge.resetNonce()).to.equal(0);

    const replacementSource = getAuthors().slice(5, 6).concat(getAuthors().slice(0, 3));
    const fundedSigners = await Promise.all(replacementSource.map(a => ethers.Wallet.createRandom().connect(ethers.provider)));
    await Promise.all(fundedSigners.map(s => owner.sendTransaction({ to: s.address, value: ethers.parseEther('1') })));
    const replacementAuthors = fundedSigners.map(s => toAuthorAccount(s));
    while (replacementAuthors.length < 4) {
      const fresh = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({ to: fresh.address, value: ethers.parseEther('1') });
      replacementAuthors.push(toAuthorAccount(fresh));
    }

    await expect(
      bridge.reset(
        [lowerId],
        [lastPublishedTxId],
        [merkleTree.rootHash],
        [relayer.address],
        replacementAuthors.map(a => a.t1Address),
        replacementAuthors.map(a => a.t1PubKeyLHS),
        replacementAuthors.map(a => a.t1PubKeyRHS),
        replacementAuthors.map(a => a.t2PubKey)
      )
    )
      .to.emit(bridge, 'LogReset')
      .withArgs(1);

    expect(await bridge.isPublishedRootHash(merkleTree.rootHash)).to.equal(false);
    expect(await bridge.isUsedLower(lowerId)).to.equal(false);
    expect(await bridge.relayerBalance(relayer.address)).to.equal(0);
    expect(await bridge.corroborate(lastPublishedTxId, 0)).to.equal(-1);

    for (const oldAuthor of originalAuthors) {
      expect(await bridge.t1AddressToId(oldAuthor.t1Address)).to.equal(0);
      expect(await bridge.t2PubKeyToId(oldAuthor.t2PubKey)).to.equal(0);
    }

    expect(await bridge.numActiveAuthors()).to.equal(BigInt(replacementAuthors.length));
    expect(await bridge.nextAuthorId()).to.equal(BigInt(replacementAuthors.length + 1));
    for (let i = 0; i < replacementAuthors.length; i++) {
      const id = i + 1;
      expect(await bridge.idToT1Address(id)).to.equal(replacementAuthors[i].t1Address);
      expect(await bridge.idToT2PubKey(id)).to.equal(replacementAuthors[i].t2PubKey);
      expect(await bridge.isAuthor(id)).to.equal(true);
      expect(await bridge.authorIsActive(id)).to.equal(true);
    }
    expect(await bridge.resetNonce()).to.equal(1);
  });

  it('rejects non-owner reset', async () => {
    await expect(bridge.connect(user).reset([], [], [], [], [], [], [], [])).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
  });

  it('preserves owner across resets', async () => {
    const fresh = [];
    while (fresh.length < 4) {
      const signer = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({ to: signer.address, value: ethers.parseEther('1') });
      fresh.push(toAuthorAccount(signer));
    }

    await bridge.reset(
      [],
      [],
      [],
      [],
      fresh.map(a => a.t1Address),
      fresh.map(a => a.t1PubKeyLHS),
      fresh.map(a => a.t1PubKeyRHS),
      fresh.map(a => a.t2PubKey)
    );

    expect(await bridge.owner()).to.equal(owner.address);
  });

  it('lets the same lowerId be claimed again after reset', async () => {
    const amount = 50n;
    await token.approve(bridge.target, amount * 2n);
    await bridge.lift(token.target, await bridge.deriveT2PublicKey(owner.address), amount * 2n);

    const [firstProof, lowerId] = await createLowerProof(bridge, token, amount, user);
    await bridge.claimLower(firstProof);
    await expect(bridge.claimLower(firstProof)).to.be.revertedWithCustomError(bridge, 'LowerIsUsed');

    const replacementAuthors = getAuthors().slice(0, 5);

    await bridge.reset(
      [lowerId],
      [],
      [],
      [],
      replacementAuthors.map(a => a.t1Address),
      replacementAuthors.map(a => a.t1PubKeyLHS),
      replacementAuthors.map(a => a.t1PubKeyRHS),
      replacementAuthors.map(a => a.t2PubKey)
    );

    expect(await bridge.isUsedLower(lowerId)).to.equal(false);
  });
});
