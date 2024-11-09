import {decodeFunctionResult, encodeFunctionData} from "viem";
import {generatePrivateKey, privateKeyToAccount} from "viem/accounts";
import {artifacts} from "hardhat";
import {bigint} from "hardhat/internal/core/params/argumentTypes";

export async function claimTokens(client: any, userClient: any, contractAddress: string) {
    const claimTokensABI = {
        inputs: [],
        name: "claimTokens",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    };

    const callData = encodeFunctionData({
        abi: [claimTokensABI],
        functionName: "claimTokens",
        args: [],
    });

    const txHash = await userClient.sendTransaction({
        to: contractAddress,
        data: callData,
    });
    return client.waitForTransactionReceipt({hash: txHash})
}


export async function buyGsxForUsdc(client: any, userClient: any, gsxTokenAddress: string, purchaseAmountGsxToken: bigint) {
    const buyTx = await userClient.sendTransaction({
        to: gsxTokenAddress,
        data: encodeFunctionData({
            abi: [{ name: "buyGsxForUsdc", type: "function", inputs: [{ name: "amount", type: "uint256" }] }],
            functionName: "buyGsxForUsdc",
            args: [purchaseAmountGsxToken],
        }),
    });
    return client.waitForTransactionReceipt({ hash: buyTx });
}

export async function buyGsxAtomsForUsdc(client: any, userClient: any, gsxTokenAddress: string, purchaseAmountGsxAtoms: bigint) {
    const buyTx = await userClient.sendTransaction({
        to: gsxTokenAddress,
        data: encodeFunctionData({
            abi: [{ name: "buyGsxAtomsForUsdt", type: "function", inputs: [{ name: "amount", type: "uint256" }] }],
            functionName: "buyGsxAtomsForUsdt",
            args: [purchaseAmountGsxAtoms],
        }),
    });
    return client.waitForTransactionReceipt({ hash: buyTx });
}

export async function fetchClaimableAmountForTier(client: any, userAddress: string, contractAddress: string, tier: number): Promise<bigint> {
    const functionName = "getClaimableAmountForTier";
    const inputs = [
        { name: "_wallet", type: "address" },
        { name: "tier", type: "uint8" },
    ];
    const outputs = [{ name: "", type: "uint256" }];
    const parameters: any[] = [userAddress, tier];
    return await callContractFunction(client, contractAddress, functionName, inputs, outputs, parameters) as bigint;
}


export async function callCalculateCostForGsxInUsd(client: any,
                                            contractAddress: string,
                                            userAddress: string,
                                            amountGsxAtomsToBuy: bigint,
                                            tier: number,
                                            usdDecimal: bigint | number) {
    const functionName = "calculateCostForGsxInUsdAtoms";
    const inputs = [
        { name: "user", type: "address" },
        { name: "amountGsxAtomsToBuy", type: "uint256" },
        { name: "tier", type: "uint8" },
        { name: "usdTokenDecimals", type: "uint256" },
    ];
    const outputs = [{ name: "", type: "uint256" }];
    const parameters: any[] = [userAddress, amountGsxAtomsToBuy, tier, usdDecimal];
    return callContractFunction(client, contractAddress, functionName, inputs, outputs, parameters);
}

export async function callContractFunction(client: any,
                                    contractAddress: string,
                                    functionName: string,
                                    inputs: { [key: string]: string }[],
                                    outputs: { [key: string]: string }[],
                                    parameters: any[],
){
    const getClaimableAmountForTierABI = {
        inputs: inputs,
        name: functionName,
        outputs: outputs,
        stateMutability: "view",
        type: "function",
    };

    try {
        const callData = encodeFunctionData({
            abi: [getClaimableAmountForTierABI],
            functionName: functionName,
            args: parameters,
        });

        const result = await client.call({
            to: contractAddress,
            data: callData,
        });

        return decodeFunctionResult({
            abi: [getClaimableAmountForTierABI],
            functionName: functionName,
            data: result.data,
        });
    } catch (error) {
        console.error(`Error fetching function ${functionName} for tier parameters ${parameters}:`, error);
        throw error;
    }
}

// export async function fetchClaimableAmountForTier(client: any, contractAddress: string, tier: number) {
//   const getClaimableAmountForTierABI = {
//     inputs: [{ name: "tier", type: "uint8" }],
//     name: "getClaimableAmountForTier",
//     outputs: [{ name: "", type: "uint256" }],
//     stateMutability: "view",
//     type: "function",
//   };
//
//   const callData = encodeFunctionData({
//     abi: [getClaimableAmountForTierABI],
//     functionName: "getClaimableAmountForTier",
//     args: [tier],
//   });
//
//   const result = await client.call({
//     to: contractAddress,
//     data: callData,
//   });
//
//   return decodeFunctionResult({
//     abi: [getClaimableAmountForTierABI],
//     functionName: "getClaimableAmountForTier",
//     data: result.data,
//   });
// }

export async function approveTokensToSpend(client: any, userClient: any, tokenAddress: string, spenderAddress: `0x${string}`, amount: bigint) {
    const approveData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "spender", type: "address" },
                    { name: "amount", type: "uint256" },
                ],
                name: "approve",
                outputs: [{ name: "", type: "bool" }],
                stateMutability: 'nonpayable',
                type: "function",
            },
        ],
        functionName: "approve",
        args: [spenderAddress, amount],
    });

    // Send the approve transaction
    const txHash = await userClient.sendTransaction({
        to: tokenAddress,
        data: approveData,
    });

    await client.waitForTransactionReceipt({ hash: txHash });
    // console.log(`Approved ${amount} tokens from ${tokenAddress} to spender ${spenderAddress}`);
}

export function generateRandomAccount() {
    const privateKey = generatePrivateKey(); // Generate a random private key
    const account = privateKeyToAccount(privateKey); // Create an account from the private key
    return { privateKey, address: account.address };
}

export async function deployContract(contractNameOrFullyQualifiedName: string, deployerAccount:any, client: any, args: any[]): Promise<`0x${string}`> {
    const artifact = await artifacts.readArtifact(contractNameOrFullyQualifiedName);
    const usdContractHash = await deployerAccount.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: args,
    });

    const receipt = await client.waitForTransactionReceipt({ hash: usdContractHash });
    if (!receipt.contractAddress) {
        throw new Error(`Contract address is missing. Could nto deploy `);
    }
    return receipt.contractAddress;
}


export async function deployGsxContract(deployerAccount:any,
                                 client: any,
                                 usdcContractAddress: string,
                                 usdtContractAddress: string,
                                 saleStartUnix: number,
                                 vestingStartUnix: number): Promise<`0x${string}`> {
    const validatorsRewardsWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000001';
    const communityReserveWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000002';
    const seedRoundWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000003';
    const cexDexWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000004';
    // const preSeedWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000006';
    const teamWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000007';
    const gsxContractArgs = [
        usdcContractAddress,
        usdtContractAddress,
        validatorsRewardsWalletAddress,
        communityReserveWalletAddress,
        seedRoundWalletAddress,
        cexDexWalletAddress,
        // preSeedWalletAddress,
        teamWalletAddress,
        saleStartUnix,
        vestingStartUnix
    ]
    return deployContract("GSXToken", deployerAccount, client, gsxContractArgs);
}


export async function deployGsxContractV2(deployerAccount:any,
                                        client: any,
                                        usdcContractAddress: string,
                                        usdtContractAddress: string,
                                        saleStartUnix: number,
                                        vestingStartUnix: number): Promise<`0x${string}`> {
    const validatorsRewardsWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000001';
    const communityReserveWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000002';
    const seedRoundWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000003';
    const cexDexWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000004';
    const operationalReservesAddress: `0x${string}` = '0x0000000000000000000000000000000000000005';
    const teamWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000007';
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
    return deployContract("GSXTokenV2", deployerAccount, client, gsxContractArgs);
}


export async function getBalanceOfErc20AtomsForAccount(client: any, accountAddress: string, erc20Address: string): Promise<bigint> {
    const balanceOfABI = {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    };

    const balanceData = encodeFunctionData({
        abi: [balanceOfABI],
        functionName: "balanceOf",
        args: [accountAddress],
    });

    const balanceResult = await client.call({
        to: erc20Address,
        data: balanceData,
    });

    return decodeFunctionResult({
        abi: [balanceOfABI],
        functionName: "balanceOf",
        data: balanceResult.data,
    }) as bigint;
}

export async function transferTokens(account: any, client: any, tokenAddress: string, recipient: string, amount: number | bigint) {

    const transferData = encodeFunctionData({
        abi: [
            {
                inputs: [
                    { name: "_to", type: "address" },
                    { name: "_value", type: "uint256" },
                ],
                name: "transfer",
                outputs: [{ name: "", type: "bool" }],
                type: "function",
            },
        ],
        functionName: "transfer",
        args: [recipient, amount],
    });


    const txHash = await account.sendTransaction({
        to: tokenAddress,
        data: transferData,
    });


    await client.waitForTransactionReceipt({ hash: txHash });
}

export async function fetchCurrentTier(client: any, contractAddress: string): Promise<number> {
    const getCurrentTierABI = {
        inputs: [],
        name: "getCurrentTier",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    };

    const data = encodeFunctionData({
        abi: [getCurrentTierABI],
        functionName: "getCurrentTier",
        args: [],
    });

    const result = await client.call({
        to: contractAddress,
        data,
    });

    return decodeFunctionResult({
        abi: [getCurrentTierABI],
        functionName: "getCurrentTier",
        data: result.data,
    }) as number;
}

export class GsxContractWrapperV2 {
    gsxTokenAbi: any;
    gsxTokenAddress: string;
    publicClient: any;

    constructor(
        abi: any,
        gsxTokenAddress: `0x${string}`,
        publicClient: any
    ) {
        this.gsxTokenAbi = abi;
        this.gsxTokenAddress = gsxTokenAddress;
        this.publicClient = publicClient;
    }

    private async _writeContract(interactionClient: any, functionName: string, args: any[] | undefined){
        const hash = await interactionClient.writeContract({
            address: this.gsxTokenAddress,
            abi: this.gsxTokenAbi,
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

    async buyGsxAtomsForUsdc(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxAtomsForUsdc", [purchaseAmountGsxToken]);
    }

    async buyGsxForUsdc(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxForUsdc", [purchaseAmountGsxToken]);
    }

    async buyGsxAtomsForUsdt(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxAtomsForUsdt", [purchaseAmountGsxToken]);
    }

    async buyGsxForUsdt(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxForUsdt", [purchaseAmountGsxToken]);
    }

    async getClaimableAmountForTier(interactionClient: any, userAddress: `0x${string}`, tier: number) {
        // TODO get rid of hardHatClient
        // return this._writeContract(interactionClient, "getClaimableAmountForTier", [userAddress, tier]); // return a hash todo fix
        return fetchClaimableAmountForTier(this.publicClient, userAddress, this.gsxTokenAddress, tier);
    }

    async claimTokens(interactionClient: any) {
        return this._writeContract(interactionClient, "claimTokens", undefined);
    }

    async getCurrentTier() {
        // return this._writeContract(interactionClient, "getCurrentTier", undefined);
        return await fetchCurrentTier(this.publicClient, this.gsxTokenAddress);
    }

    async calculateCostForGsxInUsdAtoms(interactionClient: any, userAddress: `0x${string}`, purchaseAmountGsxToken: bigint, tier: number, usdTokenDecimals: bigint) {
        // return this._writeContract(interactionClient, "calculateCostForGsxInUsdAtoms", [userAddress, purchaseAmountGsxToken, tier, usdTokenDecimals]);
        // TODO get rid of hardHatClient
        return await callCalculateCostForGsxInUsd(this.publicClient, this.gsxTokenAddress, userAddress, purchaseAmountGsxToken, tier, usdTokenDecimals) as any as bigint;
    }

    async whitelistSupporter(interactionClient: any, supporterAddress: `0x${string}`) {
        return this._writeContract(interactionClient, "whitelistSupporter", [supporterAddress]);
    }

    async removeSupporterFromWhitelist(interactionClient: any, supporterAddress: `0x${string}`) {
        return this._writeContract(interactionClient, "removeSupporterFromWhitelist", [supporterAddress]);
    }
}

export class GsxContractWrapper {
    gsxTokenAbi: any;
    gsxTokenAddress: string;
    publicClient: any;

    constructor(
        abi: any,
        gsxTokenAddress: `0x${string}`,
        publicClient: any
    ) {
        this.gsxTokenAbi = abi;
        this.gsxTokenAddress = gsxTokenAddress;
        this.publicClient = publicClient;
    }

    private async _writeContract(interactionClient: any, functionName: string, args: any[] | undefined){
        const hash = await interactionClient.writeContract({
            address: this.gsxTokenAddress,
            abi: this.gsxTokenAbi,
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

    async buyGsxAtomsForUsdc(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxAtomsForUsdc", [purchaseAmountGsxToken]);
    }

    async buyGsxForUsdc(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxForUsdc", [purchaseAmountGsxToken]);
    }

    async buyGsxAtomsForUsdt(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxAtomsForUsdt", [purchaseAmountGsxToken]);
    }

    async buyGsxForUsdt(interactionClient: any, purchaseAmountGsxToken: bigint) {
        return this._writeContract(interactionClient, "buyGsxForUsdt", [purchaseAmountGsxToken]);
    }

    async getClaimableAmountForTier(interactionClient: any, userAddress: `0x${string}`, tier: number) {
        // TODO get rid of hardHatClient
        // return this._writeContract(interactionClient, "getClaimableAmountForTier", [userAddress, tier]); // return a hash todo fix
        return fetchClaimableAmountForTier(this.publicClient, userAddress, this.gsxTokenAddress, tier);
    }

    async claimTokens(interactionClient: any) {
        return this._writeContract(interactionClient, "claimTokens", undefined);
    }

    async getCurrentTier() {
        // return this._writeContract(interactionClient, "getCurrentTier", undefined);
        return await fetchCurrentTier(this.publicClient, this.gsxTokenAddress);
    }

    async calculateCostForGsxInUsdAtoms(interactionClient: any, userAddress: `0x${string}`, purchaseAmountGsxToken: bigint, tier: number, usdTokenDecimals: bigint) {
        // return this._writeContract(interactionClient, "calculateCostForGsxInUsdAtoms", [userAddress, purchaseAmountGsxToken, tier, usdTokenDecimals]);
        // TODO get rid of hardHatClient
        return await callCalculateCostForGsxInUsd(this.publicClient, this.gsxTokenAddress, userAddress, purchaseAmountGsxToken, tier, usdTokenDecimals) as any as bigint;
    }
}

export class GsxConverterCalculator {
    tierPricesInUsdCents: { [key: number]: number };
    gsxDecimals: bigint;
    usdcDecimals: bigint;
    usdtDecimals: bigint;

    constructor(
        gsxDecimals: bigint,
        usdcDecimals: bigint,
        usdtDecimals: bigint,
        tierPricesInUsdCents: { [key: number]: number },
    ) {
        this.gsxDecimals = gsxDecimals;
        this.usdcDecimals = usdcDecimals;
        this.usdtDecimals = usdtDecimals;
        this.tierPricesInUsdCents = tierPricesInUsdCents;
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
        const priceInCents = this.tierPricesInUsdCents[tier];
        if (priceInCents === undefined) {
            throw new Error(`There is no tier price for ${tier}`);
        }
        return usdcAtoms * this.gsxDecimals * 100n / BigInt(priceInCents) / this.usdcDecimals;
    }

    getUsdcAtomsForGsxAtoms(gsxAtoms: bigint, tier: number) {
        const priceInCents = this.tierPricesInUsdCents[tier];
        if (priceInCents === undefined) {
            throw new Error(`There is no tier price for ${tier}`);
        }
        return gsxAtoms * this.usdcDecimals * BigInt(priceInCents) / 100n / this.gsxDecimals;
    }
}


export function bigintApproximatelyEquals(first: bigint, second: bigint, delta: bigint) {
    let bigger;
    let smaller
    if (first > second){
        bigger = first;
        smaller = second;
    } else {
        smaller = first;
        bigger = second;
    }
    // console.log(smaller, bigger, bigger - smaller);
    return bigger - smaller < delta;
}