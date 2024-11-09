import { createPublicClient, http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";
import {gsxContractArgs} from "./constructorArgsV2";
import {appendToDeployedContractsFile} from "./fileManagement";

dotenv.config();

const contractJsonPath = "../artifacts/contracts/GSXTokenV2.sol/GSXTokenV2.json";


function getValidatedPrivateKey(privateKey: string | undefined): `0x${string}` {
    if (!privateKey) {
        throw new Error("PRIVATE_KEY is not defined in the .env file");
    }

    const normalizedKey = privateKey.trim().startsWith('0x')
        ? privateKey.trim()
        : `0x${privateKey.trim()}`;

    if (normalizedKey.length !== 66) {
        throw new Error("Invalid private key length. Private key must be 32 bytes (64 hex characters).");
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedKey)) {
        throw new Error("Invalid private key format. It must be a 32-byte hexadecimal string.");
    }

    return normalizedKey as `0x${string}`;
}

async function main() {
    const chain = sepolia;

    const privateKey = getValidatedPrivateKey(process.env.PRIVATE_KEY);

    const walletClient = createWalletClient({
        account: privateKeyToAccount(privateKey),
        chain,
        transport: http(process.env.SEPOLIA_RPC_URL || ""),
    });

    const publicClient = createPublicClient({
        chain,
        transport: http(process.env.SEPOLIA_RPC_URL || ""),
    });

    const contractJSON = JSON.parse(
        readFileSync(resolve(__dirname, contractJsonPath), "utf-8")
    );

    const { abi, bytecode } = contractJSON;

    const deployHash = await walletClient.deployContract({
        abi,
        bytecode,
        args: gsxContractArgs,
    });

    console.log("Deploy transaction hash:", deployHash);

    const receipt = await publicClient.waitForTransactionReceipt({
        hash: deployHash,
    });

    console.log("GSXTokenV2 deployed at:", receipt.contractAddress);
    if (receipt.contractAddress) {
        await appendToDeployedContractsFile(receipt.contractAddress);
    }
}

main()
    .then(() => {
        console.log("Deployment successful");
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });