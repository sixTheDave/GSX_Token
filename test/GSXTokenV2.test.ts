import { expect } from "chai";
import "@nomicfoundation/hardhat-viem";
import hre from "hardhat";
import {
  bigintApproximatelyEquals,
} from "./GsxContractUtils";
import {PublicClient, WalletClient} from "@nomicfoundation/hardhat-viem/src/types";
import {GsxContractWrapperV2, GsxConverterCalculatorV2, PublicClientWrapper} from "./GSXTokenV2Utils";
import {
  getOneWeekInSeconds,
  getThirtyDaysInSeconds
} from "./BlockchainTimeManipulation";
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  cexDexWalletAddress,
  cexDexWalletTokenDistributionAtoms,
  communityReserveWalletAddress,
  communityReserveWalletTokenDistributionAtoms,
  operationalReservesAddress,
  operationalReservesWalletTokenDistributionAtoms,
  seedRoundWalletAddress,
  seedRoundWalletTokenDistributionAtoms,
  teamWalletAddress, teamWalletTokenDistributionAtoms,
  validatorsRewardsWalletAddress,
  validatorsRewardsWalletTokenDistributionAtoms, fairLaunchAmount, gsxInitialSupply, GSX_TOKEN_DECIMALS
} from "./testGlobals";
import { createWalletClient, custom } from 'viem';


describe("GSXToken Contract", function () {
  // ------------------------ SETUP ----------------------------
  const priceGsxInUsdCents: bigint = 85n;

  const ownerAccountAddress: `0x${string}` = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const ownerAccountPrivateKey: `0x${string}` = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const adminAccountAddress: `0x${string}` = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const adminPrivateKey: `0x${string}` = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const referrerAccountAddress: `0x${string}` = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
  const referrerPrivateKey: `0x${string}` = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
  const zeroAddress: `0x${string}` = "0x0000000000000000000000000000000000000000";

  let publicClient: PublicClient;
  let publicClientWrapper: PublicClientWrapper;
  let ownerClient: WalletClient;
  let adminClient: WalletClient;
  let userClient: WalletClient;
  let referrerClient: WalletClient;

  const USDC_DECIMALS = 10n ** 6n;
  const USDT_DECIMALS = 10n ** 6n;
  let usdcContract: any;
  let usdtContract: any;
  const bonusInPercentForTier: { [key: number]: bigint } = {
    1: 85n,
    2: 25n,
    3: 0n
  }
  const tierVestingPeriodMonths: { [key: number]: number } = {
    1: 9,
    2: 6,
    3: 0
  }
  const duration_tier_1_seconds = getOneWeekInSeconds() * 2; // 2 weeks
  const duration_tier_2_seconds = getOneWeekInSeconds() * 2; // 2 weeks
  const duration_tier_3_seconds = getOneWeekInSeconds() * 2; // 2 weeks
  let calculator = new GsxConverterCalculatorV2(GSX_TOKEN_DECIMALS, USDC_DECIMALS, USDT_DECIMALS, priceGsxInUsdCents, bonusInPercentForTier);
  const refererRewardPercent = 10n;
  const referralUserDiscountPercent = 5n;

  before(async function () {
    publicClient = await hre.viem.getPublicClient();
    publicClientWrapper = new PublicClientWrapper(publicClient);

    // Create ownerClient with private key
    const ownerAccount = privateKeyToAccount(ownerAccountPrivateKey);
    ownerClient = createWalletClient({
      account: ownerAccount,
      chain: publicClient.chain,
      transport: custom(publicClient.transport),
    });

    // Create adminClient with private key
    const adminAccount = privateKeyToAccount(adminPrivateKey);
    adminClient = createWalletClient({
      account: adminAccount,
      chain: publicClient.chain,
      transport: custom(publicClient.transport),
    });

  });

  beforeEach(async function () {
    const userAccount = privateKeyToAccount(generatePrivateKey());
    userClient = createWalletClient({
      account: userAccount,
      chain: publicClient.chain,
      transport: custom(publicClient.transport),
    });

    const referrerAccount = privateKeyToAccount(referrerPrivateKey);
    referrerClient = createWalletClient({
      account: referrerAccount,
      chain: publicClient.chain,
      transport: custom(publicClient.transport),
    });

    usdcContract = await hre.viem.deployContract("MockERC20",
        ["Mock USDC", "USDC", 1_000_000n * USDC_DECIMALS],
        {client: { wallet: ownerClient }}
    );
    usdtContract = await hre.viem.deployContract("MockERC20",
        ["Mock USDT", "USDT", 1_000_000n * USDT_DECIMALS],
        {client: { wallet: ownerClient }}
    );

    await publicClientWrapper.transfer(ownerClient, userClient.account.address, 10n ** 18n);
    await publicClientWrapper.transferTokens(ownerClient, usdcContract, userClient.account.address, 99999n * USDT_DECIMALS);
    await publicClientWrapper.transferTokens(ownerClient, usdtContract, userClient.account.address, 99999n * USDT_DECIMALS);
  });

  // ------------------------ TESTS ----------------------------

  it("User should have ETH, USDC & USDT", async function () {
    const userBalance = await publicClient.getBalance({
      address: userClient.account.address,
    });
    expect(userBalance > 0n).to.be.true;

    const usdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    const usdtBalance = await publicClientWrapper.balanceOfTokenForAddress(usdtContract, userClient.account.address);
    expect(usdcBalance > 0n).to.be.true;
    expect(usdtBalance > 0n).to.be.true;
  });

  it("Should distribute the initial tokens to the designated wallets correctly", async function () {
    const addressesAndExpectedAmounts = [
      { address: validatorsRewardsWalletAddress, expectedAmount: validatorsRewardsWalletTokenDistributionAtoms },
      { address: communityReserveWalletAddress, expectedAmount: communityReserveWalletTokenDistributionAtoms },
      { address: seedRoundWalletAddress, expectedAmount: seedRoundWalletTokenDistributionAtoms },
      { address: cexDexWalletAddress, expectedAmount: cexDexWalletTokenDistributionAtoms },
      { address: teamWalletAddress, expectedAmount: teamWalletTokenDistributionAtoms },
      { address: operationalReservesAddress, expectedAmount: operationalReservesWalletTokenDistributionAtoms },
    ];

    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);

    for (const { address, expectedAmount } of addressesAndExpectedAmounts) {
      const balance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, address);
      expect(balance).to.equal(expectedAmount);
    }

    const totalDistributed = addressesAndExpectedAmounts.reduce(
        (acc, { expectedAmount }) => acc + expectedAmount,
        0n
    );
    const remainingBalance = gsxInitialSupply - totalDistributed;
    const contractBalanceLeftForSale = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, gsxWrapper.getAddress());
    expect(contractBalanceLeftForSale).to.equal(remainingBalance);
    expect(contractBalanceLeftForSale).to.equal(fairLaunchAmount);
  });

  it("Should get the current blockchain timestamp", async function () {
    expect(await publicClientWrapper.getCurrentBlockchainTimestamp()).to.be.a('number');
  });

  it("Should fetch claimable amount for a specific tier", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    expect(await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, 1)).to.be.a('bigint');
    expect(await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, 2)).to.be.a('bigint');
    expect(await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, 3)).to.be.a('bigint');
  });

  it("Should allow the user to buy GSX tokens using USDC for Tier 3", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);
    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.saleStartUnix + duration_tier_1_seconds + duration_tier_2_seconds);

    const expectedTier = 3;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    const purchaseAmountGsx = 100n ;
    const expectedUsdcAmountSpent = 85n;
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpent = expectedUsdcAmountSpent * USDC_DECIMALS;
    const expectedBonus = purchaseAmountGsxAtoms * bonusInPercentForTier[currentTier] / 100n;
    const expectedAmountGsxAtomsWithBonus = purchaseAmountGsxAtoms + expectedBonus;

    const userInitialGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    const userInitialUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    const contractGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, gsxWrapper.getAddress());
    const contractUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());

    expect(contractGsxBalance > purchaseAmountGsxAtoms);
    expect(contractUsdcBalance).to.be.equal(0n);

    await publicClientWrapper.approveTokensToSpend(userClient, usdcContract, gsxWrapper.getAddress(), expectedUsdcAtomsAmountSpent);
    await gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx);

    const userFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    expect(userInitialUsdcBalance - userFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    const contractFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());
    expect(contractFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.vestingStartUnix);

    const fetchClaimableAmountForTier = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, currentTier);
    expect(fetchClaimableAmountForTier).to.equal(expectedAmountGsxAtomsWithBonus);

    // can immediately claim all tier 3 tokens
    await gsxWrapper.claimTokens(userClient);
    const claimedAmount = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    expect(claimedAmount).to.equal(expectedAmountGsxAtomsWithBonus);
  });

  it("Should allow the user to buy GSX tokens using USDC for Tier 1 and claim everything after 9 month", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);

    const expectedTier = 1;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    const purchaseAmountGsx = 100n ;
    const expectedUsdcAmountSpent = 85n;
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpent = expectedUsdcAmountSpent * USDC_DECIMALS;
    const expectedBonus = purchaseAmountGsxAtoms * bonusInPercentForTier[currentTier] / 100n;
    const expectedAmountGsxAtomsWithBonus = purchaseAmountGsxAtoms + expectedBonus;

    const userInitialGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    const userInitialUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    const contractGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, gsxWrapper.getAddress());
    const contractUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());

    expect(contractGsxBalance > purchaseAmountGsxAtoms);
    expect(contractUsdcBalance).to.be.equal(0n);

    await publicClientWrapper.approveTokensToSpend(userClient, usdcContract, gsxWrapper.getAddress(), expectedUsdcAtomsAmountSpent);
    await gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx);

    const userFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    expect(userInitialUsdcBalance - userFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    const contractFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());
    expect(contractFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    const tierVestingDurationInSeconds = getThirtyDaysInSeconds() * (tierVestingPeriodMonths[expectedTier] + 1);
    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.vestingStartUnix + tierVestingDurationInSeconds);

    const claimableAmountForTier = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, currentTier);
    expect(claimableAmountForTier).to.equal(expectedAmountGsxAtomsWithBonus);

    await gsxWrapper.claimTokens(userClient);
    const claimedAmount = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    expect(claimedAmount).to.equal(expectedAmountGsxAtomsWithBonus);
  });

  it("Should allow the user to buy GSX tokens using USDC for Tier 1 and claim every month during 6 month", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);

    const expectedTier = 1;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    const purchaseAmountGsx = 200n ;
    const expectedUsdcAmountSpent = 170n;
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpent = expectedUsdcAmountSpent * USDC_DECIMALS;
    const expectedBonus = purchaseAmountGsxAtoms * bonusInPercentForTier[currentTier] / 100n;
    const expectedAmountGsxAtomsWithBonus = purchaseAmountGsxAtoms + expectedBonus;

    const userInitialGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    const userInitialUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    const contractGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, gsxWrapper.getAddress());
    const contractUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());

    expect(contractGsxBalance > purchaseAmountGsxAtoms);
    expect(contractUsdcBalance).to.be.equal(0n);

    await publicClientWrapper.approveTokensToSpend(userClient, usdcContract, gsxWrapper.getAddress(), expectedUsdcAtomsAmountSpent);
    await gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx);

    const userFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    expect(userInitialUsdcBalance - userFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    const contractFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());
    expect(contractFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);


    const currentVestingPeriodMonths = tierVestingPeriodMonths[expectedTier];
    const expectedClaimablePerMonth = expectedAmountGsxAtomsWithBonus / BigInt(currentVestingPeriodMonths);
    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.vestingStartUnix);
    let currentUserGsxBalance = userInitialGsxBalance;
    for (let i = 0; i < currentVestingPeriodMonths; i++) {
      const claimableAmountForTier = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, currentTier);
      expect(bigintApproximatelyEquals(claimableAmountForTier, expectedClaimablePerMonth, 10n)).to.be.true;

      const previousUserGsxBalance = currentUserGsxBalance;
      await gsxWrapper.claimTokens(userClient);
      currentUserGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
      expect(bigintApproximatelyEquals(currentUserGsxBalance - previousUserGsxBalance, expectedClaimablePerMonth, 10n)).to.be.true;

      await publicClientWrapper.setNextBlockTimestamp(await publicClientWrapper.getCurrentBlockchainTimestamp() + getThirtyDaysInSeconds());
    }
    expect(currentUserGsxBalance).to.equal(expectedAmountGsxAtomsWithBonus);
  });

  it("Should allow the user to buy GSX tokens using USDC for Tier 2 and claim everything after 6 month", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);
    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.saleStartUnix + duration_tier_1_seconds);

    const expectedTier = 2;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    const purchaseAmountGsx = 100n ;
    const expectedUsdcAmountSpent = 85n;
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpent = expectedUsdcAmountSpent * USDC_DECIMALS;
    const expectedBonus = purchaseAmountGsxAtoms * bonusInPercentForTier[currentTier] / 100n;
    const expectedAmountGsxAtomsWithBonus = purchaseAmountGsxAtoms + expectedBonus;

    const userInitialGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    const userInitialUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    const contractGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, gsxWrapper.getAddress());
    const contractUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());

    expect(contractGsxBalance > purchaseAmountGsxAtoms);
    expect(contractUsdcBalance).to.be.equal(0n);

    await publicClientWrapper.approveTokensToSpend(userClient, usdcContract, gsxWrapper.getAddress(), expectedUsdcAtomsAmountSpent);
    await gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx);

    const userFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    expect(userInitialUsdcBalance - userFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    const contractFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());
    expect(contractFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    const tierVestingDurationInSeconds = getThirtyDaysInSeconds() * (tierVestingPeriodMonths[expectedTier] + 1);
    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.vestingStartUnix + tierVestingDurationInSeconds);

    const claimableAmountForTier = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, currentTier);
    expect(claimableAmountForTier).to.equal(expectedAmountGsxAtomsWithBonus);

    await gsxWrapper.claimTokens(userClient);
    const claimedAmount = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    expect(claimedAmount).to.equal(expectedAmountGsxAtomsWithBonus);
  });

  it("Should allow the user to buy GSX tokens using USDC for Tier 2 and claim every month during 6 month", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);
    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.saleStartUnix + duration_tier_1_seconds);

    const expectedTier = 2;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    const purchaseAmountGsx = 4500n ;
    const expectedUsdcAmountSpent = 3825n;
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpent = expectedUsdcAmountSpent * USDC_DECIMALS;
    const expectedBonus = purchaseAmountGsxAtoms * bonusInPercentForTier[currentTier] / 100n;
    const expectedAmountGsxAtomsWithBonus = purchaseAmountGsxAtoms + expectedBonus;

    const userInitialGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    const userInitialUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    const contractGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, gsxWrapper.getAddress());
    const contractUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());

    expect(contractGsxBalance > purchaseAmountGsxAtoms);
    expect(contractUsdcBalance).to.be.equal(0n);

    await publicClientWrapper.approveTokensToSpend(userClient, usdcContract, gsxWrapper.getAddress(), expectedUsdcAtomsAmountSpent);
    await gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx);

    const userFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    expect(userInitialUsdcBalance - userFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);

    const contractFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());
    expect(contractFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent);


    const currentVestingPeriodMonths = tierVestingPeriodMonths[expectedTier];
    const expectedClaimablePerMonth = expectedAmountGsxAtomsWithBonus / BigInt(currentVestingPeriodMonths);
    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.vestingStartUnix);
    let currentUserGsxBalance = userInitialGsxBalance;
    for (let i = 0; i < currentVestingPeriodMonths; i++) {
      const claimableAmountForTier = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, currentTier);
      expect(bigintApproximatelyEquals(claimableAmountForTier, expectedClaimablePerMonth, 10n)).to.be.true;

      const previousUserGsxBalance = currentUserGsxBalance;
      await gsxWrapper.claimTokens(userClient);
      currentUserGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
      expect(bigintApproximatelyEquals(currentUserGsxBalance - previousUserGsxBalance, expectedClaimablePerMonth, 10n)).to.be.true;

      await publicClientWrapper.setNextBlockTimestamp(await publicClientWrapper.getCurrentBlockchainTimestamp() + getThirtyDaysInSeconds());
    }
    expect(currentUserGsxBalance).to.equal(expectedAmountGsxAtomsWithBonus);
  });

  it("Should allow the user to buy GSX tokens using USDC for multiple Tiers and claim every month during 9 month", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);

    const expectedTier = 1;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    // Buys 100 GSX in each of 3 Tiers

    const purchaseAmountGsx = 100n;
    const expectedUsdcAmountSpent = 85n;
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpent = expectedUsdcAmountSpent * USDC_DECIMALS;

    const expectedBonus = calculator.getGsxAtomBonusForTier(purchaseAmountGsxAtoms, 1) + calculator.getGsxAtomBonusForTier(purchaseAmountGsxAtoms, 2);
    const expectedAmountGsxAtomsWithBonus = purchaseAmountGsxAtoms * 3n + expectedBonus;


    const userInitialGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    const userInitialUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    const contractGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, gsxWrapper.getAddress());
    const contractUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());

    expect(contractGsxBalance > purchaseAmountGsxAtoms);
    expect(contractUsdcBalance).to.be.equal(0n);

    for (let i = 0; i < 3; i++) {
      await publicClientWrapper.approveTokensToSpend(userClient, usdcContract, gsxWrapper.getAddress(), expectedUsdcAtomsAmountSpent);
      await gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx);
      await publicClientWrapper.setNextBlockTimestamp(await publicClientWrapper.getCurrentBlockchainTimestamp() + getOneWeekInSeconds() * 2);
    }

    const userFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, userClient.account.address);
    expect(userInitialUsdcBalance - userFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent * 3n);

    const contractFinalUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(usdcContract, gsxWrapper.getAddress());
    expect(contractFinalUsdcBalance).to.be.equal(expectedUsdcAtomsAmountSpent * 3n);

    await publicClientWrapper.setNextBlockTimestamp(gsxWrapper.vestingStartUnix);

    const tier1ClaimablePerMonthWithBonusAtoms = calculator.getGsxAtomsTotalAmountWithBonusForTier(purchaseAmountGsxAtoms, 1) / BigInt(tierVestingPeriodMonths[1]);
    const tier2ClaimablePerMonthWithBonusAtoms = calculator.getGsxAtomsTotalAmountWithBonusForTier(purchaseAmountGsxAtoms, 2) / BigInt(tierVestingPeriodMonths[2]);
    const tier3ClaimablePerMonthWithBonusAtoms = purchaseAmountGsxAtoms;
    const expectedClaimableForEachMonthInGsxAtoms: { [key: number]: bigint } = {
      0 : tier1ClaimablePerMonthWithBonusAtoms + tier2ClaimablePerMonthWithBonusAtoms + tier3ClaimablePerMonthWithBonusAtoms,
      1 : tier1ClaimablePerMonthWithBonusAtoms + tier2ClaimablePerMonthWithBonusAtoms,
      2 : tier1ClaimablePerMonthWithBonusAtoms + tier2ClaimablePerMonthWithBonusAtoms,
      3 : tier1ClaimablePerMonthWithBonusAtoms + tier2ClaimablePerMonthWithBonusAtoms,
      4 : tier1ClaimablePerMonthWithBonusAtoms + tier2ClaimablePerMonthWithBonusAtoms,
      5 : tier1ClaimablePerMonthWithBonusAtoms + tier2ClaimablePerMonthWithBonusAtoms,
      6 : tier1ClaimablePerMonthWithBonusAtoms,
      7 : tier1ClaimablePerMonthWithBonusAtoms,
      8 : tier1ClaimablePerMonthWithBonusAtoms,
    }

    let currentUserGsxBalance = userInitialGsxBalance;
    for (let i = 0; i < 9; i++) {
      const claimableAmountForTier1 = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, 1);
      const claimableAmountForTier2 = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, 2);
      const claimableAmountForTier3 = await gsxWrapper.getClaimableAmountForTier(userClient, userClient.account.address, 3);
      const totalClaimable = claimableAmountForTier1 + claimableAmountForTier2 + claimableAmountForTier3;

      const expectedClaimableForCurrentMonth = expectedClaimableForEachMonthInGsxAtoms[i];
      expect(bigintApproximatelyEquals(totalClaimable, expectedClaimableForCurrentMonth, 10n)).to.be.true;

      const previousUserGsxBalance = currentUserGsxBalance;
      await gsxWrapper.claimTokens(userClient);
      currentUserGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
      expect(bigintApproximatelyEquals(currentUserGsxBalance - previousUserGsxBalance, expectedClaimableForCurrentMonth, 10n)).to.be.true;

      await publicClientWrapper.setNextBlockTimestamp(await publicClientWrapper.getCurrentBlockchainTimestamp() + getThirtyDaysInSeconds());
    }
    expect(currentUserGsxBalance).to.equal(expectedAmountGsxAtomsWithBonus);
  });

  it("Should allow admin or owner to whitelist and set referrers", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);

    let isWhitelisted = await gsxWrapper.readWhitelistedReferrers(referrerClient.account.address);
    expect(isWhitelisted).to.be.false;

    // Admin adds referrer to the whitelist
    await gsxWrapper.whitelistReferrer(adminClient, referrerClient.account.address);

    // Verify that the referrer has been whitelisted
    isWhitelisted = await gsxWrapper.readWhitelistedReferrers(referrerClient.account.address);
    expect(isWhitelisted).to.be.true;

    let usersReferrer = await gsxWrapper.readUsersReferrers(userClient.account.address);
    expect(usersReferrer).to.equal(zeroAddress);

    await gsxWrapper.addReferrer(adminClient, userClient.account.address, referrerClient.account.address);

    usersReferrer = await gsxWrapper.readUsersReferrers(userClient.account.address);
    expect(usersReferrer).to.equal(referrerClient.account.address);
  });


  it("Should apply refferal bonus for supporter and count referees bought amounts", async function () {
    const gsxWrapper: GsxContractWrapperV2 = await GsxContractWrapperV2.deployDefaultGsxContract(publicClient, ownerClient, usdcContract.address, usdtContract.address);
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistReferrer(adminClient, referrerClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);
    await gsxWrapper.addReferrer(adminClient, userClient.account.address, referrerClient.account.address);

    // buys tokens
    const expectedTier = 1;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    const purchaseAmountGsx = 100n;
    const expectedUsdcAmountSpent = 85n;
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpentBeforeDiscount = expectedUsdcAmountSpent * USDC_DECIMALS;
    const expectedUsdcAtomsAmountSpentAfterDiscount = expectedUsdcAtomsAmountSpentBeforeDiscount / 100n * 95n;
    const expectedBonus = purchaseAmountGsxAtoms * bonusInPercentForTier[currentTier] / 100n;
    const expectedAmountGsxAtomsWithBonus = purchaseAmountGsxAtoms + expectedBonus;

    await publicClientWrapper.approveTokensToSpend(userClient, usdcContract, gsxWrapper.getAddress(), expectedUsdcAtomsAmountSpentAfterDiscount);
    await gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx);

    // check supporter discount

    const userInitialGsxBalance = await publicClientWrapper.balanceOfTokenForAddress(gsxWrapper.viemContract, userClient.account.address);
    expect(userInitialGsxBalance).to.equal(0n);
    const userVestedAmount = await gsxWrapper.readVestedAmountsGsxAtoms(userClient.account.address, expectedTier);
    expect(userVestedAmount).to.equal(expectedAmountGsxAtomsWithBonus);


    const totalUsdAtomsSpentByReferrersSupporters = await gsxWrapper.readTotalUsdAtomsSpentByReferrersSupporters(referrerClient.account.address);
    expect(totalUsdAtomsSpentByReferrersSupporters).to.equal(expectedUsdcAtomsAmountSpentAfterDiscount);

  });


 it("Should not allow user to buy tokens if total purchase amount is less than the minimum", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(
      publicClient,
      ownerClient,
      usdcContract.address,
      usdtContract.address
    );
    await gsxWrapper.setReferralAdmin(ownerClient, adminClient.account.address);
    await gsxWrapper.whitelistSupporter(adminClient, userClient.account.address);
    const expectedTier = 1;
    const currentTier = await gsxWrapper.getCurrentTier();
    expect(currentTier).to.equal(expectedTier);

    // Attempt to purchase tokens worth less than $50
    const purchaseAmountGsx = 10n; // Small amount
    const purchaseAmountGsxAtoms = purchaseAmountGsx * GSX_TOKEN_DECIMALS;
    const expectedUsdcAtomsAmountSpent = 10n * USDC_DECIMALS / 100n * 85n;


    expect(expectedUsdcAtomsAmountSpent < 50n * USDC_DECIMALS).to.be.true;

    await publicClientWrapper.approveTokensToSpend(
      userClient,
      usdcContract,
      gsxWrapper.getAddress(),
      expectedUsdcAtomsAmountSpent
    );

    await expect(
      gsxWrapper.contributeGsxForUsdc(userClient, purchaseAmountGsx)
    ).to.be.rejectedWith("Minimum purchase amount is not reached");
  });

  it("Should allow owner to withdraw USDC tokens from the contract", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(
        publicClient,
        ownerClient,
        usdcContract.address,
        usdtContract.address
    );

    // Simulate some USDC tokens in the contract
    const depositAmount = 1000n * USDC_DECIMALS;
    await publicClientWrapper.transferTokens(
        ownerClient,
        usdcContract,
        gsxWrapper.getAddress(),
        depositAmount
    );

    const contractUsdcBalanceBefore = await publicClientWrapper.balanceOfTokenForAddress(
        usdcContract,
        gsxWrapper.getAddress()
    );
    expect(contractUsdcBalanceBefore).to.equal(depositAmount);

    const recipientAddress = ownerAccountAddress;
    const withdrawAmount = 500n * USDC_DECIMALS;



    const recipientUsdcBalanceBeforeWithdraw = await publicClientWrapper.balanceOfTokenForAddress(
        usdcContract,
        recipientAddress
    );

    await gsxWrapper.withdrawUsdTokens(ownerClient, usdcContract.address, withdrawAmount, recipientAddress);

    const contractUsdcBalanceAfter = await publicClientWrapper.balanceOfTokenForAddress(
        usdcContract,
        gsxWrapper.getAddress()
    );
    expect(contractUsdcBalanceAfter).to.equal(depositAmount - withdrawAmount);

    const recipientUsdcBalance = await publicClientWrapper.balanceOfTokenForAddress(
        usdcContract,
        recipientAddress
    );
    expect(recipientUsdcBalance - recipientUsdcBalanceBeforeWithdraw).to.equal(withdrawAmount);
  });


  it("Should not allow non-owner to withdraw USDC tokens from the contract", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(
        publicClient,
        ownerClient,
        usdcContract.address,
        usdtContract.address
    );

    // Simulate some USDC tokens in the contract
    const depositAmount = 1000n * USDC_DECIMALS;
    await publicClientWrapper.transferTokens(
        ownerClient,
        usdcContract,
        gsxWrapper.getAddress(),
        depositAmount
    );

    const recipientAddress = userClient.account.address;
    const withdrawAmount = 500n * USDC_DECIMALS;

    await expect(
        gsxWrapper.withdrawUsdTokens(userClient, usdcContract.address, withdrawAmount, recipientAddress)
    ).to.be.rejected;
  });


  it("Should not allow withdrawing USDC tokens to the zero address", async function () {
    const gsxWrapper = await GsxContractWrapperV2.deployDefaultGsxContract(
        publicClient,
        ownerClient,
        usdcContract.address,
        usdtContract.address
    );

    // Simulate some USDC tokens in the contract
    const depositAmount = 1000n * USDC_DECIMALS;
    await publicClientWrapper.transferTokens(
        ownerClient,
        usdcContract,
        gsxWrapper.getAddress(),
        depositAmount
    );

    const recipientAddress = zeroAddress;
    const withdrawAmount = 500n * USDC_DECIMALS;

    await expect(
        gsxWrapper.withdrawUsdTokens(ownerClient, usdcContract.address, withdrawAmount, recipientAddress)
    ).to.be.rejectedWith("Cannot withdraw to the zero address");
  });

});
