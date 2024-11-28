require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function extractSurface() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const collection = client.db('gravelatlas').collection('road_surfaces');

    // Find documents where 'other_tags' contains 'surface'
    const cursor = collection.find({ 'properties.other_tags': { $regex: /"surface"=>/ } });

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const otherTags = doc.properties.other_tags;
      if (otherTags) {
        const surface = extractSurfaceFromOtherTags(otherTags);
        if (surface) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: { 'properties.surface': surface } }
          );
          console.log(`Updated document with _id: ${doc._id}, set surface: ${surface}`);
        }
      }
    }
    console.log('Surface extraction completed.');
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
