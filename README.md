# GSX Token Summary

- Tokens for G6 Networks, so anyone who passes the KYC (sorry, we are in EU) can contribute to the building of G6 Networks Public Blockchain.
- Maximum supply is 80 000 000.
- This is a Fair Launch, so everyone contributes on the same rates.
- Early contributors receive bonus, this is our way to say thank you for trusting us. The earlier someone contributes, the more bonus is provided.
- Vesting is set for early contributors.
- USDT and USDC are accepted by the contract.
- There is a 5% bonus for the supporters who come by referrals.
- Referral bonuses will be paid manually.
- KYC is not free for our company, so we had to set a minimum amount for the first contribution.
- This token will be paused when all tokens get migrated to the upcoming G6 Networks Public Blockchain and then ownership renounced.

Roles are defined at the end of the readme.

# Install dev environment

```shell
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"\n[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
npm install hardhat
npx hardhat test
```

# Hardhat Instructions

Running and testing example:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

# Test
- Start the hardhat node with `pnpm hardhat node`
- Run tests with `pnpm hardhat test`


# Sepolia testnet USDC and USDT

## Test deployment addresses
Eg. you can load it into Remix/Ganache or deploy a new: 0xa0777d8a768562C67b48a904e03E9Aa0C7a15096

## Faucet
- For Sepolia Coins: [https://www.sepoliafaucet.io/](https://www.sepoliafaucet.io/) 

- For USDT and USC: [https://staging.aave.com/faucet/](https://staging.aave.com/faucet/)

## Set Allowance on testnet USDC and USDT
Before getting GSX tokens, the spendings need to be allowed.

USDC: [https://sepolia.etherscan.io/token/0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8?a=0x402cabdB70A2a9da88adBa0654E0af671716eFef#writeContract](https://sepolia.etherscan.io/token/0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8?a=0x402cabdB70A2a9da88adBa0654E0af671716eFef#writeContract)

USDT: [https://sepolia.etherscan.io/token/0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0?a=0x402cabdB70A2a9da88adBa0654E0af671716eFef#writeContract](https://sepolia.etherscan.io/token/0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0?a=0x402cabdB70A2a9da88adBa0654E0af671716eFef#writeContract)

# Roles and Deployment
The base role is user, it needs to be whitelisted by the admin (after KYC so we stay compliant to EU regulations).

These wallets needs to be generated before the deployment (each of them is a separate role):

- 0x32238600f062dd50633CE5D27F825ccb5F3aB155 ~ Contract owner account: has the most power, can do everything
- 0x199a1c9bA3eDbE2F05C52B2632644A7f638D30b9 ~ Contract admin: can whitelist referees, set referees for supporters, whitelist supporters
- 0xdB687143a0B963FbEb5DCEE1839D9016FE24a97c ~ Validators Rewards Wallet
- 0xfAC494bFBB8106C0C1f21aF8d11dB9bf5e73D7BA ~ Community Reserve Wallet
- 0xF2410C2D4e02c7E842f1542Da6bf2862dcfE9cD4 ~ Seed Round Wallet
- 0x6126F9A052156616601b337f5EDa21B31b962a97 ~ CexDex Wallet
- 0x81952e12E2A61b6ce89F9eA73da1f5F2C39A1c42 ~ Operational Reserves Wallet
- 0xed3695B7C1FD32210964F6585b69021D94f80446 ~ Team Wallet

Also two timestamps should be passed as arguments when created. Both are Unix seconds timestamps.

Also two usd contract addresses should be provided. The network USDC and USDT addresses.

The poarameters to the contract will bne in the following order:
```
gsxContractArgs = [
    usdcContractAddress,
    usdtContractAddress,
    validatorsRewardsWalletAddress,
    communityReserveWalletAddress,
    seedRoundWalletAddress,
    cexDexWalletAddress,
    preSeedWalletAddress,
    teamWalletAddress,
    saleStartUnix, // e.g. 1726200017 // Fri Sep 13 2024 04:00:17 GMT+0000
    vestingStartUnix // e.g. 1730433617; // Fri Nov 01 2024 04:00:17 GMT+0000
]
```