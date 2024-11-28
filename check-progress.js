require('dotenv').config();
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

async function checkProgress() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const collection = client.db('gravelatlas').collection('road_surfaces');
    
    const totalDocs = await collection.countDocuments({ 'properties.other_tags': { $regex: /"surface"=>/ } });
    const processedDocs = await collection.countDocuments({ 'properties.surface': { $exists: true } });
    const percentComplete = ((processedDocs / totalDocs) * 100).toFixed(2);

    console.log(`Progress: ${processedDocs}/${totalDocs} (${percentComplete}%)`);
  } finally {
    await client.close();
  }
}

checkProgress().catch(console.error);