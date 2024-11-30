require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const JSONStream = require('JSONStream');

const RELEVANT_TYPES = new Set([
  'motorway', 'motorway_link',
  'trunk', 'trunk_link',
  'primary', 'primary_link',
  'secondary', 'secondary_link',
  'tertiary', 'tertiary_link',
  'residential', 'living_street', 'road',
  'unclassified', 'service'
]);

async function importRoads() {
    console.log('Starting import process...');
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected successfully');

        const collection = client.db('gravelatlas').collection('road_surfaces');
        
        let totalCount = 0;
        let skippedCount = 0;
        let duplicateCount = 0;
        let updatedCount = 0;
        let batch = [];
        let processedCount = 0;

        // Create a promise to handle the stream
        await new Promise((resolve, reject) => {
            const jsonStream = JSONStream.parse('features.*');
            const fileStream = fs.createReadStream('./roads.geojson');

            fileStream.pipe(jsonStream);

            jsonStream.on('data', async (feature) => {
                processedCount++;
                
                if (processedCount % 1000 === 0) {
                    console.log(`Processed ${processedCount} features...`);
                }

                if (!feature.properties) {
                    skippedCount++;
                    return;
                }

                const highway = feature.properties.highway;
                const osm_id = feature.properties.osm_id || `generated_${processedCount}`;

                if (!highway) {
                    skippedCount++;
                    return;
                }

                if (RELEVANT_TYPES.has(highway)) {
                    batch.push({
                        updateOne: {
                            filter: { 'properties.osm_id': osm_id },
                            update: { $set: feature },
                            upsert: true
                        }
                    });

                    if (batch.length === 1000) {
                        try {
                            const result = await collection.bulkWrite(batch);
                            totalCount += result.upsertedCount;
                            updatedCount += result.modifiedCount;
                            duplicateCount += (batch.length - result.upsertedCount - result.modifiedCount);
                            
                            console.log(`Progress - New: ${totalCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}, Duplicates: ${duplicateCount}`);
                            batch = [];
                        } catch (err) {
                            console.error('Error writing batch:', err);
                        }
                    }
                } else {
                    skippedCount++;
                }
            });

            jsonStream.on('error', (error) => {
                console.error('Stream error:', error);
                reject(error);
            });

            jsonStream.on('end', async () => {
                // Process remaining batch
                if (batch.length > 0) {
                    try {
                        const result = await collection.bulkWrite(batch);
                        totalCount += result.upsertedCount;
                        updatedCount += result.modifiedCount;
                        duplicateCount += (batch.length - result.upsertedCount - result.modifiedCount);
                    } catch (err) {
                        console.error('Error writing final batch:', err);
                    }
                }
                resolve();
            });
        });

        console.log(`Import complete:
Total features processed: ${processedCount}
New features imported: ${totalCount}
Features updated: ${updatedCount}
Features skipped: ${skippedCount}
Duplicates found: ${duplicateCount}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

importRoads().catch(console.error);