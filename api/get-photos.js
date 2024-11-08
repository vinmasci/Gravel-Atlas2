const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection setup
let client;

async function connectToMongo() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
    }
    return client.db('photoApp').collection('photos');  // Use your MongoDB collection name
}

module.exports = async (req, res) => {
    try {
        const collection = await connectToMongo();
        const photos = await collection.find().toArray();
        res.status(200).json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ error: 'Error fetching photos' });
    }
};
