
export function getUnixNowSeconds(){
    return Math.floor(Date.now() / 1000)
}

export function getOneDayInSeconds(){
    return 24 * 60 * 60;
}

export function getOneWeekInSeconds(){
    return 7 * getOneDayInSeconds();
}

export function getThirtyDaysInSeconds(){
    return 30 * getOneDayInSeconds();
}

export async function increaseTime(client: any, seconds: number) {
    // Increase the blockchain time by the given number of seconds
    await client.request({ method: "evm_increaseTime", params: [seconds] });
    await client.request({ method: "evm_mine", params: [] }); // Mine a new block to apply the time change
}

export async function setNextBlockTimestamp(client: any, timestamp: number) {
    await client.request({ method: "evm_setNextBlockTimestamp", params: [timestamp] });
    await client.request({ method: "evm_mine", params: [] }); // Mine a new block with the new timestamp
}

export async function getCurrentBlockchainTimestamp(client: any): Promise<number> {
    const latestBlock = await client.request({
        method: "eth_getBlockByNumber",
        params: ["latest", false], // false means don't return the full transactions, just block info
    });

    // Convert from hex to decimal
    return parseInt(latestBlock.timestamp, 16);
}