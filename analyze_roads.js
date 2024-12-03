// analyze_roads.js
const fs = require('fs');

const highwayTypes = new Map();
const surfaceTypes = new Map();
const highwaySurfaceCombos = new Map();

// Read file in chunks
const readStream = fs.createReadStream('roads.geojson', {
    encoding: 'utf8',
    highWaterMark: 1024 * 1024 // Read 1MB at a time
});

let buffer = '';
let inFeature = false;
let openBraces = 0;

readStream.on('data', chunk => {
    buffer += chunk;
    
    // Process complete features
    let startIdx = 0;
    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === '{') openBraces++;
        if (buffer[i] === '}') {
            openBraces--;
            if (openBraces === 0 && inFeature) {
                try {
                    const feature = JSON.parse(buffer.slice(startIdx, i + 1));
                    const props = feature.properties || {};
                    const highway = props.highway;
                    const surface = props.surface;
                    
                    if (highway) {
                        highwayTypes.set(highway, (highwayTypes.get(highway) || 0) + 1);
                    }
                    if (surface) {
                        surfaceTypes.set(surface, (surfaceTypes.get(surface) || 0) + 1);
                    }
                    if (highway && surface) {
                        const combo = `${highway}-${surface}`;
                        highwaySurfaceCombos.set(combo, (highwaySurfaceCombos.get(combo) || 0) + 1);
                    }
                } catch (e) {
                    // Skip malformed JSON
                }
                inFeature = false;
                startIdx = i + 1;
            }
        }
        
        // Look for start of a feature
        if (!inFeature && buffer.slice(i, i + 9) === '{"type":"') {
            inFeature = true;
            startIdx = i;
        }
    }
    
    // Keep remainder for next chunk
    buffer = buffer.slice(startIdx);
});

readStream.on('end', () => {
    console.log("\nHighway Types:");
    console.log("-------------");
    Array.from(highwayTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            console.log(`${type}: ${count}`);
        });

    console.log("\nSurface Types:");
    console.log("-------------");
    Array.from(surfaceTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            console.log(`${type}: ${count}`);
        });

    console.log("\nTop Highway-Surface Combinations:");
    console.log("-----------------------------");
    Array.from(highwaySurfaceCombos.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([combo, count]) => {
            console.log(`${combo}: ${count}`);
        });
});

readStream.on('error', error => {
    console.error('Error reading file:', error);
});