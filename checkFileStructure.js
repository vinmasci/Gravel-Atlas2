const fs = require('fs');
const readline = require('readline');

async function checkFileStructure() {
    const rl = readline.createInterface({
        input: fs.createReadStream('./roads.geojson')
    });
    
    let lineCount = 0;
    for await (const line of rl) {
        if (lineCount < 5) {
            console.log('Line', lineCount + 1, ':', line.substring(0, 100));
        }
        lineCount++;
    }
    console.log('Total lines:', lineCount);
}

checkFileStructure();