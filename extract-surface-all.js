require('dotenv').config();
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

// Define relevant unpaved surfaces
const UNPAVED_SURFACES = new Set([
    'unpaved', 'dirt', 'gravel', 'earth', 'soil', 'ground',
    'rock', 'rocks', 'stone', 'stones', 'pebblestone', 'loose_rocks',
    'sand', 'clay', 'mud', 'grass', 'woodchips',
    'fine_gravel', 'crushed_limestone', 'compacted',
    'laterite', 'caliche', 'coral', 'shell_grit', 'tundra',
    'chalk', 'limestone', 'shale', 'crusher_run', 'decomposed_granite'
]);

async function extractSurface() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const collection = client.db('gravelatlas').collection('road_surfaces');
        
        const cursor = collection.find({
            'properties.other_tags': { $regex: /"surface"=>/ }
        });

        let processedCount = 0;
        let updatedCount = 0;
        let unpavedCount = 0;

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            processedCount++;

            if (processedCount % 1000 === 0) {
                console.log(`Processed ${processedCount} documents, Found ${unpavedCount} unpaved surfaces`);
            }

            const otherTags = doc.properties.other_tags;
            if (otherTags) {
                const surface = extractSurfaceFromOtherTags(otherTags);
                if (surface && UNPAVED_SURFACES.has(surface.toLowerCase())) {
                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { 'properties.surface': surface } }
                    );
                    updatedCount++;
                    unpavedCount++;
                    if (updatedCount % 100 === 0) {
                        console.log(`Updated document with unpaved surface: ${surface} (${unpavedCount} unpaved surfaces found)`);
                    }
                }
            }
        }

        console.log(`
Surface extraction completed:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total documents processed: ${processedCount}
Unpaved surfaces found: ${unpavedCount}
Total documents updated: ${updatedCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    } catch (error) {
        console.error('Error extracting surface:', error);
    } finally {
        await client.close();
    }
}

function extractSurfaceFromOtherTags(otherTags) {
    const regex = /"surface"=>"([^"]+)"/;
    const match = otherTags.match(regex);
    return match ? match[1] : null;
}

extractSurface().catch(console.error);