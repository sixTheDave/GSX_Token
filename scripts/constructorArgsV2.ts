import {getOneDayInSeconds, getOneWeekInSeconds, getUnixNowSeconds} from "../test/BlockchainTimeManipulation";

const sepoliaUsdcContractAddress: `0x${string}` = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const sepoliaUsdtContractAddress: `0x${string}` = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
// const saleStartUnix: number = 1726200017; // Fri Sep 13 2024 04:00:17 GMT+0000
// const vestingStartUnix: number = 1730433617; // Fri Nov 01 2024 04:00:17 GMT+0000
// const saleStartUnix: number = getUnixNowSeconds() + 300;
// const vestingStartUnix: number = saleStartUnix + getOneWeekInSeconds() * 7;
const saleStartUnix: number = 1729105369;
const vestingStartUnix: number = saleStartUnix + getOneWeekInSeconds() * 7;
const validatorsRewardsWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000001';
const communityReserveWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000002';
const seedRoundWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000003';
const cexDexWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000004';
const operationalReservesAddress: `0x${string}` = '0x0000000000000000000000000000000000000006';
const teamWalletAddress: `0x${string}` = '0x0000000000000000000000000000000000000007';
export const gsxContractArgs = [
    sepoliaUsdcContractAddress,
    sepoliaUsdtContractAddress,
    validatorsRewardsWalletAddress,
    communityReserveWalletAddress,
    seedRoundWalletAddress,
    cexDexWalletAddress,
    operationalReservesAddress,
    teamWalletAddress,
    saleStartUnix,
    vestingStartUnix
]
