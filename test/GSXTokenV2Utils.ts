import {PublicClient, WalletClient} from "@nomicfoundation/hardhat-viem/src/types";
import {bigint} from "hardhat/internal/core/params/argumentTypes";
import {encodeFunctionData, TransactionReceipt} from "viem";
import {
    approveTokensToSpend,
    callCalculateCostForGsxInUsd,
    deployContract,
    fetchClaimableAmountForTier,
    fetchCurrentTier
} from "./GsxContractUtils";
import {
    getCurrentBlockchainTimestamp,
    getOneDayInSeconds,
    getOneWeekInSeconds,
    setNextBlockTimestamp
} from "./BlockchainTimeManipulation";
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
    validatorsRewardsWalletTokenDistributionAtoms, fairLaunchAmount
} from "./testGlobals";
import hre from "hardhat";


export class PublicClientWrapper {
    publicClient: PublicClient;

    constructor(
        publicClient: PublicClient
    ) {
        this.publicClient = publicClient;
    }

    async transfer(fromClient: WalletClient, toAddress: `0x${string}`, transferAmount: bigint): Promise<TransactionReceipt> {
        const txHash = await fromClient.sendTransaction({
            to: toAddress,
            value: transferAmount,
        });
        return await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    }

    async balanceOfTokenForAddress(tokenContract: any, address: `0x${string}`): Promise<bigint> {
        return await this.publicClient.readContract({
            address: tokenContract.address,
            abi: tokenContract.abi,
            functionName: 'balanceOf',
            args: [address],
        }) as bigint;
    }

    async transferTokens(
        fromClient: WalletClient,
        tokenContract: any,
        toAddress: `0x${string}`,
        amount: bigint
    ): Promise<void> {
        // Encode the transfer function
        const transferData = encodeFunctionData({
            abi: tokenContract.abi,
            functionName: 'transfer',
            args: [toAddress, amount],
        });

        // Send the transaction using the sender's client
        const txHash = await fromClient.sendTransaction({
            to: tokenContract.address,
            data: transferData,
        });

        // Wait for transaction receipt
        await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    }

    async approveTokensToSpend(
        fromClient: WalletClient,
        tokenContract: any,
        spenderAddress: `0x${string}`,
        amount: bigint
    ): Promise<void> {
        // Encode the approve function
        const approveData = encodeFunctionData({
            abi: tokenContract.abi,
            functionName: 'approve',
            args: [spenderAddress, amount],
        });

        // Send the transaction using the sender's client
        const txHash = await fromClient.sendTransaction({
            to: tokenContract.address,
            data: approveData,
        });

        await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    }

    // async approveTokensToSpend(
    //     fromClient: WalletClient,
    //     tokenContract: any,
    //     spenderAddress: `0x${string}`,
    //     amount: bigint
    // ): Promise<void> {
    //     await approveTokensToSpend(this.publicClient, fromClient, tokenContract.address, spenderAddress, amount);
    // }

    async getCurrentBlockchainTimestamp(): Promise<number> {
        const latestBlock = await this.publicClient.request({
            method: "eth_getBlockByNumber",
            params: ["latest", false], // false means don't return the full transactions, just block info
        });

        // Convert from hex to decimal
        return parseInt(latestBlock!.timestamp, 16);
    }

    async setNextBlockTimestamp(timestamp: number) {
        await setNextBlockTimestamp(this.publicClient, timestamp);
    }

}


export class GsxContractWrapperV2 {
    static contractName: string = "GSXTokenV2";
    viemContract: any;
    publicClient: PublicClient;
    saleStartUnix: number;
    vestingStartUnix: number;

    constructor(
        viemContract: any,
        publicClient: PublicClient,
        saleStartUnix: number,
        vestingStartUnix: number

    ) {
        this.viemContract = viemContract;
        this.publicClient = publicClient;
        this.saleStartUnix = saleStartUnix;
        this.vestingStartUnix = vestingStartUnix;
    }

    static async deployDefaultGsxContract(
        publicClient: PublicClient,
        deployerAccount: WalletClient,
        usdcContractAddress: string,
        usdtContractAddress: string
    ): Promise<GsxContractWrapperV2> {
        const currentTimestamp = await getCurrentBlockchainTimestamp(publicClient);
        const saleStartUnix = currentTimestamp;
        const vestingStartUnix = currentTimestamp + getOneWeekInSeconds() * 7;
        const gsxContractArgs = [
            usdcContractAddress,
            usdtContractAddress,
            validatorsRewardsWalletAddress,
            communityReserveWalletAddress,
            seedRoundWalletAddress,
            cexDexWalletAddress,
            operationalReservesAddress,
            teamWalletAddress,
            saleStartUnix,
            vestingStartUnix
        ]

        const viemContract  = await hre.viem.deployContract(this.contractName,
            gsxContractArgs,
            {client: { wallet: deployerAccount }}
        );

        return new GsxContractWrapperV2(viemContract, publicClient, saleStartUnix, vestingStartUnix);
    }

    public getAbi(){
        return this.viemContract.abi;
    }

    public getAddress(): `0x${string}`{
        return this.viemContract.address;
    }

    private async _writeContract(interactionClient: any, functionName: string, args: any[] | undefined){
        const hash = await interactionClient.writeContract({
            address: this.getAddress(),
            abi: this.getAbi(),
            functionName: functionName,
            args: args,
        });
        return hash;
    }

    public async setReferralAdmin(interactionClient: any, referrerAdminClientAddress: `0x${string}`) {
        return this._writeContract(interactionClient, "setReferralAdmin", [referrerAdminClientAddress]);
    }

    public async whitelistReferrer(referrerAdminClient: any, referrerAccountAddress: `0x${string}`) {
        return this._writeContract(referrerAdminClient, "whitelistReferrer", [referrerAccountAddress]);
    }

    public async addReferrer(referrerAdminClient: any, userAddress: `0x${string}`, referrerAccountAddress: `0x${string}`) {
        return this._writeContract(referrerAdminClient, "addReferrer", [userAddress, referrerAccountAddress]);
    }

    async claimReferralRewards(interactionClient: any) {
        return this._writeContract(interactionClient, "claimReferralRewards", undefined);
    }

    async contributeGsxAtomsForUsdc(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "contributeGsxAtomsForUsdc", [purchaseAmountGsxToken]);
    }

    async contributeGsxForUsdc(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "contributeGsxForUsdc", [purchaseAmountGsxToken]);
    }

    async contributeGsxAtomsForUsdt(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "contributeGsxAtomsForUsdt", [purchaseAmountGsxToken]);
    }

    async contributeGsxForUsdt(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "contributeGsxForUsdt", [purchaseAmountGsxToken]);
    }

    async withdrawUsdTokens(interactionClient: WalletClient, tokenAddress: `0x${string}`, amountAtoms: bigint, toAddress: `0x${string}`) {
        return this._writeContract(interactionClient, "withdrawUsdTokens", [tokenAddress, amountAtoms, toAddress]);
    }

    async getClaimableAmountForTier(interactionClient: any, userAddress: `0x${string}`, tier: number) {
        // TODO get rid of hardHatClient
        // return this._writeContract(interactionClient, "getClaimableAmountForTier", [userAddress, tier]); // return a hash todo fix
        return fetchClaimableAmountForTier(this.publicClient, userAddress, this.viemContract.address, tier);
    }

    async claimTokens(interactionClient: any) {
        return this._writeContract(interactionClient, "claimTokens", undefined);
    }

    async getCurrentTier() {
        // return this._writeContract(interactionClient, "getCurrentTier", undefined);
        return await fetchCurrentTier(this.publicClient, this.viemContract.address);
    }


    async calculateCostForGsxInUsdAtoms(interactionClient: any, userAddress: `0x${string}`, purchaseAmountGsxToken: bigint, tier: number, usdTokenDecimals: bigint) {
        // return this._writeContract(interactionClient, "calculateCostForGsxInUsdAtoms", [userAddress, purchaseAmountGsxToken, tier, usdTokenDecimals]);
        // TODO get rid of hardHatClient
        return await callCalculateCostForGsxInUsd(this.publicClient, this.viemContract.address, userAddress, purchaseAmountGsxToken, tier, usdTokenDecimals) as any as bigint;
    }

    async whitelistSupporter(interactionClient: any, supporterAddress: `0x${string}`) {
        return this._writeContract(interactionClient, "whitelistSupporter", [supporterAddress]);
    }

    async removeSupporterFromWhitelist(interactionClient: any, supporterAddress: `0x${string}`) {
        return this._writeContract(interactionClient, "removeSupporterFromWhitelist", [supporterAddress]);
    }

    /**
     * Generic method to read a view function from the smart contract
     * @param functionName - The name of the function to call
     * @param args - The arguments to pass to the function
     * @returns {Promise<T>} - The result of the contract call
     */
    async readContractMethod<T>(functionName: string, args: any[] = []): Promise<T> {
        const result = await this.publicClient.readContract({
            address: this.viemContract.address,
            abi: this.viemContract.abi,
            functionName: functionName,
            args: args,
        });

        return result as T;
    }

    /**
     * Check if the referrer is whitelisted using the generic read method
     * @param address - The address of the referrer to check
     * @returns {Promise<boolean>} - True if the referrer is whitelisted, false otherwise
     */
    async readWhitelistedReferrers(address: `0x${string}`): Promise<boolean> {
        return this.readContractMethod<boolean>('whitelistedReferrers', [address]);
    }

    async readUsersReferrers(address: `0x${string}`): Promise<`0x${string}`> {
        return this.readContractMethod<`0x${string}`>('usersReferrers', [address]);
    }

    async readVestedAmountsGsxAtoms(address: `0x${string}`, tier: number): Promise<bigint> {
        return this.readContractMethod<bigint>('vestedAmountsGsxAtoms', [address, tier]);
    }

    async readSingleWalletPurchaseLimitInUsdAtoms(): Promise<bigint> {
        return this.readContractMethod<bigint>('singleWalletPurchaseLimitInUsdAtoms', []);
    }

    async readTotalUsdAtomsSpentByReferrersSupporters(referrer: `0x${string}`): Promise<bigint> {
        return this.readContractMethod<bigint>('totalUsdAtomsSpentByReferrersSupporters', [referrer]);
    }
}


export class GsxConverterCalculatorV2 {
    bonusInPercentForTier: { [key: number]: bigint };
    gsxDecimals: bigint;
    usdcDecimals: bigint;
    usdtDecimals: bigint;
    priceGsxInUsdCents: bigint;

    constructor(
        gsxDecimals: bigint,
        usdcDecimals: bigint,
        usdtDecimals: bigint,
        priceGsxInUsdCents: bigint,
        bonusInPercentForTier: { [key: number]: bigint },
    ) {
        this.gsxDecimals = gsxDecimals;
        this.usdcDecimals = usdcDecimals;
        this.usdtDecimals = usdtDecimals;
        this.bonusInPercentForTier = bonusInPercentForTier;
        this.priceGsxInUsdCents = priceGsxInUsdCents;
    }

    getGsxForGsxAtoms(atoms: bigint) {
        let result = atoms / this.gsxDecimals;
        if (result <= 0n) {
            console.warn("Conversion yielded a 0. Might be a faulty behaviour");
        }
        return result;
    }

    getUsdcForUsdcAtoms(atoms: bigint) {
        let result = atoms / this.usdcDecimals;
        if (result <= 0n) {
            console.warn("Conversion yielded a 0. Might be a faulty behaviour");
        }
        return result;
    }

    getUsdtForUsdtAtoms(atoms: bigint) {
        let result = atoms / this.usdtDecimals;
        if (result <= 0n) {
            console.warn("Conversion yielded a 0. Might be a faulty behaviour");
        }
        return result;
    }

    getGsxAtomsForGsx(gsx: bigint) {
        return gsx * this.gsxDecimals;
    }

    getUsdcAtomsForUsdc(usd: bigint) {
        return usd * this.usdcDecimals;
    }

    getUsdtAtomsForUsdt(usd: bigint) {
        return usd * this.usdtDecimals;
    }

    getGsxAtomsForUsdcAtoms(usdcAtoms: bigint, tier: number) {
        const bonusInPercentForTier = this.bonusInPercentForTier[tier];
        if (bonusInPercentForTier === undefined) {
            throw new Error(`There is no tier price for ${tier}`);
        }
        const baseConversion = (usdcAtoms * this.gsxDecimals * 100n / this.priceGsxInUsdCents / this.usdcDecimals);
        return baseConversion + baseConversion * bonusInPercentForTier / 100n;
    }

    getGsxAtomsTotalAmountWithBonusForTier(gsxAtoms: bigint, tier: number) {
        return gsxAtoms + this.getGsxAtomBonusForTier(gsxAtoms, tier);
    }

    getGsxAtomBonusForTier(gsxAtoms: bigint, tier: number) {
        const bonusInPercentForTier = this.bonusInPercentForTier[tier];
        if (bonusInPercentForTier === undefined) {
            throw new Error(`There is no tier price for ${tier}`);
        }
        return gsxAtoms * bonusInPercentForTier / 100n;
    }

}