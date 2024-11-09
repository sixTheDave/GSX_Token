import * as fs from 'fs';
import * as path from 'path';

const FILE_NAME = 'deployedContracts.txt';

export async function appendToDeployedContractsFile(lineToAppend: string) {
    const filePath = path.join(__dirname, FILE_NAME);

    fs.appendFile(filePath, "\n" + lineToAppend, (err) => {
        if (err) {
            console.error('Failed to append line:', err);
        } else {
            console.log('Line successfully appended to file.');
        }
    });
}

export async function readLastLineFromDeployedContractsFile(): Promise<string | null> {
    const filePath = path.join(__dirname, FILE_NAME);

    if (!fs.existsSync(filePath)) {
        console.error('File does not exist.');
        return null;
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.trim().split('\n');
    return lines.length > 0 ? lines[lines.length - 1] : null;
}
