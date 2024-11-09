import { run, network } from "hardhat";
import * as dotenv from "dotenv";
import {gsxContractArgs} from "./constructorArgsV2";
import {readLastLineFromDeployedContractsFile} from "./fileManagement";


dotenv.config();

async function verifyContract() {
    const contractAddress = await readLastLineFromDeployedContractsFile();
    if (!contractAddress) {
        throw new Error("contract address Could not be read");
    }
    const constructorArgs: any[] = gsxContractArgs;

    if (!contractAddress) {
        throw new Error("Contract address not provided. Set CONTRACT_ADDRESS in your .env file.");
    }

    console.log(`Current network: ${network.name}`);
    try {
        console.log(`Verifying contract at address: ${contractAddress} on the specified network...`);

        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: constructorArgs,
        });

        console.log("Contract verified successfully!");
    } catch (error) {
        console.error("Verification failed:", error);
    }
}

verifyContract().catch((error) => {
    console.error("Error in verification script:", error);
    process.exit(1);
});