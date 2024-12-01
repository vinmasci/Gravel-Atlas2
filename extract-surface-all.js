require('dotenv').config();
const { MongoClient } = require('mongodb');

const UNPAVED_SURFACES = new Set([
    'unpaved', 'dirt', 'gravel', 'earth', 'soil', 'ground',
    'rock', 'rocks', 'stone', 'stones', 'pebblestone', 'loose_rocks',
    'sand', 'clay', 'mud', 'grass', 'woodchips',
    'fine_gravel', 'crushed_limestone', 'compacted',
    'laterite', 'caliche', 'coral', 'shell_grit', 'tundra',
    'chalk', 'limestone', 'shale', 'crusher_run', 'decomposed_granite'
]);

async function extractSurfaces() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const collection = client.db('gravelatlas').collection('road_surfaces');
        
        // Find documents that have surface info in other_tags but no surface field
        const cursor = collection.find({
            'properties.other_tags': { $regex: /"surface"=>/ },
            'properties.surface': { $exists: false }
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
            
            const surface = extractSurfaceFromOtherTags(doc.properties.other_tags);
            
            if (surface) {
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { 'properties.surface': surface } }
                );
                updatedCount++;
                
                if (UNPAVED_SURFACES.has(surface.toLowerCase())) {
                    unpavedCount++;
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
        
    } finally {
        await client.close();
    }
}

function extractSurfaceFromOtherTags(otherTags) {
    const regex = /"surface"=>"([^"]+)"/;
    const match = otherTags?.match(regex);
    return match ? match[1] : null;
}

extractSurfaces().catch(console.error);