const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

let client;

async function connectToMongo() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
    }
    return client.db('photoApp').collection('photos');
}

module.exports = async (req, res) => {
    const { photoId } = req.query;

    if (!photoId) {
        return res.status(400).json({ success: false, message: "No photo ID provided." });
    }

    try {
        const collection = await connectToMongo();
        const result = await collection.deleteOne({ _id: new ObjectId(photoId) });

        if (result.deletedCount === 1) {
            res.status(200).json({ success: true, message: 'Photo deleted successfully!' });
        } else {
            res.status(404).json({ success: false, message: 'Photo not found.' });
        }
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ success: false, message: 'Failed to delete photo.' });
    }
};
