require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const readline = require('readline');

const RELEVANT_TYPES = new Set([
    'track', 'path', 'cycleway', 'bridleway', 'unclassified', 'service', 'residential'
]);

const RELEVANT_SURFACES = new Set([
    'gravel', 'dirt', 'unpaved', 'compacted', 'fine_gravel', 'earth', 'ground', 
    'sand', 'grass', 'pebblestone', 'asphalt', 'paved', 'concrete', 'sealed'
]);

async function clearAndImportRoads() {
    console.log('Starting import process...');
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        console.log('Connected successfully');
        
        const collection = client.db('gravelatlas').collection('road_surfaces');
        
        console.log('Clearing existing data...');
        await collection.deleteMany({});
        console.log('Creating index...');
        await collection.createIndex({ geometry: "2dsphere" });
        
        let batch = [];
        let totalCount = 0;
        let skippedCount = 0;
        let lineCount = 0;
        let inFeatures = false;
        
        console.log('Opening file stream...');
        const rl = readline.createInterface({
            input: fs.createReadStream('./roads.geojson'),
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            lineCount++;
            if (lineCount % 10000 === 0) {
                console.log(`Processed ${lineCount} lines...`);
            }
            
            if (line.includes('"features": [')) {
                inFeatures = true;
                continue;
            }
            
            if (inFeatures && line.includes('"type": "Feature"')) {
                try {
                    const feature = JSON.parse(line.endsWith(',') ? line.slice(0, -1) : line);
                    const highway = feature.properties.highway;
                    const surface = feature.properties.surface;
                    
                    if (RELEVANT_TYPES.has(highway) || RELEVANT_SURFACES.has(surface)) {
                        batch.push(feature);
                        if (batch.length === 1000) {
                            await collection.insertMany(batch);
                            totalCount += batch.length;
                            console.log(`Imported ${totalCount} features (Skipped: ${skippedCount})`);
                            batch = [];
                        }
                    } else {
                        skippedCount++;
                    }
                } catch (err) {
                    continue;
                }
            }
        }

        if (batch.length > 0) {
            await collection.insertMany(batch);
            totalCount += batch.length;
        }

        console.log(`Import complete:
        Total lines processed: ${lineCount}
        Total features imported: ${totalCount}
        Features skipped: ${skippedCount}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

clearAndImportRoads().catch(console.error);