require('dotenv').config();
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

async function extractSurface() {
    const client = new MongoClient(uri, { useUnifiedTopology: true });
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const collection = client.db('gravelatlas').collection('road_surfaces');
        
        // Find all documents with other_tags that contain surface info
        const cursor = collection.find({
            'properties.other_tags': { $regex: /"surface"=>/ }
        });

        let processedCount = 0;
        let updatedCount = 0;

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            processedCount++;

            if (processedCount % 1000 === 0) {
                console.log(`Processed ${processedCount} documents, Updated ${updatedCount}`);
            }

            const otherTags = doc.properties.other_tags;
            if (otherTags) {
                const surface = extractSurfaceFromOtherTags(otherTags);
                if (surface) {
                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { 'properties.surface': surface } }
                    );
                    updatedCount++;
                    if (updatedCount % 100 === 0) {
                        console.log(`Updated document with surface: ${surface} (${updatedCount} total updates)`);
                    }
                }
            }
        }

        console.log(`
Surface extraction completed:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total documents processed: ${processedCount}
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