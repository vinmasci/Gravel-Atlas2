const { MongoClient } = require('mongodb');
require('dotenv').config();

let client;
async function connectToMongo() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
    }
    return client.db('photoApp').collection('photos');
}

module.exports = async (req, res) => {
    // Enable CORS if needed
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const collection = await connectToMongo();
        
        // You can add query parameters for filtering if needed
        const query = {};
        
        // Add sorting by uploadedAt in descending order (newest first)
        const photos = await collection.find(query)
            .sort({ uploadedAt: -1 })
            .toArray();

        res.status(200).json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ error: 'Error fetching photos' });
    }
};