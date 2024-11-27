const fs = require('fs');

const fileStream = fs.createReadStream('./roads.geojson', { encoding: 'utf8' });
let first100Chars = '';

fileStream.on('data', chunk => {
    if (first100Chars.length < 100) {
        first100Chars += chunk;
        console.log("First 100 characters:", first100Chars);
        fileStream.destroy();
    }
});