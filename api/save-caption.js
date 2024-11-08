const { MongoClient, ObjectId } = require('mongodb');
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
    const { id, caption } = req.body;

    if (!id || !caption) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const collection = await connectToMongo();
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { caption: caption } }
        );

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: 'Caption saved successfully' });
        } else {
            res.status(400).json({ error: 'Failed to save caption' });
        }
    } catch (error) {
        console.error('Error saving caption:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
